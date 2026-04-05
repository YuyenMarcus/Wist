export const dynamic = 'force-dynamic'; // Force dynamic rendering to prevent caching that ignores cookies

import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { checkItemLimitForApi } from '@/lib/tier-guards';
import { convertPrice } from '@/lib/currency';
import { cleanPrice as cleanPriceValue } from '@/lib/scraper/utils';
// Dynamic import to avoid webpack analyzing scraper dependencies during build

// HELPER: Dynamic CORS Headers
function corsHeaders(origin: string | null) {
  return {
    'Access-Control-Allow-Origin': origin || '*',
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Methods': 'GET,DELETE,PATCH,POST,PUT,OPTIONS',
    'Access-Control-Allow-Headers': 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization',
  };
}

// Handle OPTIONS (Pre-flight check for CORS)
export async function OPTIONS(request: Request) {
  const origin = request.headers.get('origin');
  return NextResponse.json({}, { status: 200, headers: corsHeaders(origin) });
}

export async function POST(request: Request) {
  const origin = request.headers.get('origin');

  try {
    // 1. Get the data sent from the extension or dashboard
    const body = await request.json();
    let {
      title,
      price,
      url,
      image_url,
      status,
      retailer,
      note,
      collection_id,
      is_public,
      save_hidden,
      currency,
      out_of_stock,
      client_tier,
    } = body;

    console.log("📥 [API] Incoming Item Request:", { url, hasTitle: !!title, hasPrice: !!price });

    // -----------------------------------------------------------------------
    // 1. AUTHENTICATION FIX - CORRECTED VERSION
    // -----------------------------------------------------------------------
    let user = null;
    let supabaseClient = null;

    // Try cookie auth first (for web dashboard)
    const cookieHeader = request.headers.get('cookie') || '';
    const cookieMap = new Map<string, string>();
    if (cookieHeader) {
      cookieHeader.split(';').forEach(cookie => {
        const [name, ...valueParts] = cookie.trim().split('=');
        if (name && valueParts.length > 0) {
          cookieMap.set(name.trim(), valueParts.join('='));
        }
      });
    }

    if (cookieMap.size > 0) {
      const response = NextResponse.next();
      supabaseClient = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
          cookies: {
            getAll() {
              return Array.from(cookieMap.entries()).map(([name, value]) => ({ name, value }));
            },
            setAll(cookiesToSet) {
              cookiesToSet.forEach(({ name, value, options }) => {
                cookieMap.set(name, value);
                response.cookies.set(name, value, options);
              });
            },
          },
        }
      );

      const cookieAuth = await supabaseClient.auth.getUser();
      if (cookieAuth.data?.user) {
        user = cookieAuth.data.user;
        console.log("✅ [API] Authenticated via Cookie:", user.email);
      }
    }

    // If no cookie, check Bearer token (for extension)
    if (!user) {
      const authHeader = request.headers.get('Authorization');
      console.log("🔍 [API] Authorization Header:", authHeader ? `Present (${authHeader.substring(0, 30)}...)` : "Missing");
      
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.replace('Bearer ', '').trim();
        
        if (!token || token === 'undefined' || token === 'null') {
          console.error("❌ [API] Invalid token in Authorization header");
          return NextResponse.json(
            { error: 'Invalid token. Please log in to Wist.' },
            { status: 401, headers: corsHeaders(origin) }
          );
        }

        console.log("🔑 [API] Token length:", token.length);
        console.log("🔑 [API] Token preview:", token.substring(0, 30) + "...");
        
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
        
        if (!supabaseUrl || !supabaseAnonKey) {
          console.error("❌ [API] Missing environment variables!");
          console.error("NEXT_PUBLIC_SUPABASE_URL:", !!supabaseUrl);
          console.error("NEXT_PUBLIC_SUPABASE_ANON_KEY:", !!supabaseAnonKey);
          return NextResponse.json({ 
            error: 'Server configuration error' 
          }, { status: 500, headers: corsHeaders(origin) });
        }
        
        // CRITICAL FIX: Create a client-side Supabase instance with the token
        // The server client uses cookies, so we need a fresh instance
        const supabaseWithToken = createClient(supabaseUrl, supabaseAnonKey, {
          auth: {
            persistSession: false,
            autoRefreshToken: false
          },
          global: {
            headers: {
              Authorization: `Bearer ${token}`
            }
          }
        });
        
        console.log("🔧 [API] Created token-based Supabase client");
        
        // Verify the token by getting the user
        const { data: { user: tokenUser }, error: tokenError } = await supabaseWithToken.auth.getUser();
        
        if (tokenError) {
          console.error("❌ [API] Token verification failed:", tokenError.message);
          console.error("❌ [API] Error code:", tokenError.status);
          console.error("❌ [API] Full error:", JSON.stringify(tokenError, null, 2));
          
          // Check if token is expired
          if (tokenError.message?.includes('expired') || tokenError.status === 401) {
            return NextResponse.json({ 
              error: 'Token expired. Please log in again.',
              details: tokenError.message
            }, { status: 401, headers: corsHeaders(origin) });
          }
          
          return NextResponse.json({ 
            error: 'Token verification failed. Please log in again.',
            details: tokenError.message
          }, { status: 401, headers: corsHeaders(origin) });
        }
        
        if (tokenUser) {
          user = tokenUser;
          supabaseClient = supabaseWithToken; // Use this client for DB operations
          console.log("✅ [API] Authenticated via Bearer Token:", user.email);
        } else {
          console.error("❌ [API] Token verification returned no user");
        }
      } else {
        console.warn("⚠️ [API] No valid Authorization header found");
      }
    }

    // Final auth check
    if (!user) {
      console.error("❌ [API] Authentication failed - no user found");
      return NextResponse.json({ 
        error: 'Unauthorized. Please log in.',
        details: 'No valid session or token found'
      }, { status: 401, headers: corsHeaders(origin) });
    }

    console.log("👤 [API] User authenticated:", user.id, user.email);

    // 2b. ADULT CONTENT CHECK: Block adult items for minors
    {
      const { isAdultContent } = await import('@/lib/content-filter');
      if (title && isAdultContent(title)) {
        const profileClient = supabaseClient || createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
          { global: { headers: { Authorization: `Bearer ${request.headers.get('Authorization')?.replace('Bearer ', '') || ''}` } } }
        );
        const { data: prof } = await (profileClient as any)
          .from('profiles')
          .select('age')
          .eq('id', user.id)
          .single();

        if (prof && prof.age != null && prof.age < 18) {
          return NextResponse.json(
            { error: 'This item cannot be added to your wishlist.' },
            { status: 403, headers: corsHeaders(origin) }
          );
        }
      }
    }

    // 3a. DUPLICATE CHECK: reject if user already has this URL as an active item
    if (url && supabaseClient) {
      const normalizedUrl = url.toLowerCase().trim();
      const { data: existingItem } = await supabaseClient
        .from('items')
        .select('id, title')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .ilike('url', normalizedUrl)
        .limit(1)
        .maybeSingle();

      if (existingItem) {
        console.log("⚠️ [API] Duplicate URL, returning existing item:", existingItem.id);
        return NextResponse.json(
          { success: true, item: existingItem, duplicate: true },
          { headers: corsHeaders(origin) }
        );
      }
    }

    // 3b. CHECK: Does this URL already exist in products table?
    let existingProduct = null;
    if (url && supabaseClient) {
      const { data: productData } = await supabaseClient
        .from('products')
        .select('*')
        .eq('url', url)
        .single();
      
      if (productData) {
        existingProduct = productData;
        console.log("✅ Found existing product in catalog:", productData.title);
      }
    }

    // -----------------------------------------------------------------------
    // 2. DATA HANDLING (Prevent Crash)
    // -----------------------------------------------------------------------
    console.log("📦 [API] Request body:", JSON.stringify(body, null, 2));

    // CRITICAL FIX: Trust Extension Data (Prevent jsdom Crash)
    // If extension sent title AND price, skip scraping entirely.
    let currentPrice = 0;
    const hasExtensionData = title && (price !== undefined && price !== null);

    if (hasExtensionData) {
      // ⚡ TRUST MODE: Extension already scraped the data
      // Clean the price string (e.g. "$29.99" -> 29.99)
      currentPrice = cleanPriceValue(price.toString()) || 0;
      retailer = retailer || new URL(url).hostname.replace('www.', '').split('.')[0];
      console.log("⚡ [API] Using extension-provided data. Skipping server scrape.");
    } else if (existingProduct) {
      // A. USE EXISTING PRODUCT DATA (from products table)
      title = title || existingProduct.title || null;
      currentPrice = price 
        ? (cleanPriceValue(price.toString()) || 0)
        : (existingProduct.price ? (cleanPriceValue(existingProduct.price.toString()) || 0) : 0);
      image_url = image_url || existingProduct.image || null;
      retailer = retailer || existingProduct.domain || 'Unknown';
      console.log("✅ Using existing product data from catalog");
    } else if (url && (!title || !price)) {
      // C. SCRAPE MODE (Only for manual dashboard adds - no extension data)
      console.log("🔍 [API] No extension data provided, attempting server-side scrape for:", url);
      let scrapeQuality: 'good' | 'poor' = 'poor';
      try {
        const scraperModule = await import('@/lib/scraper/index');
        const scrapeResult = await scraperModule.scrapeProduct(url) as { ok: boolean; data?: { title?: string; price?: number; image?: string; domain?: string; outOfStock?: boolean }; error?: string; detail?: string } | null;
        
        if (scrapeResult && scrapeResult.ok && scrapeResult.data) {
          title = scrapeResult.data.title || title || 'New Item';
          currentPrice = price ? (cleanPriceValue(price.toString()) || 0) : (scrapeResult.data.price || 0);
          image_url = image_url || scrapeResult.data.image || null;
          retailer = retailer || scrapeResult.data.domain || 'Unknown';
          if (scrapeResult.data.outOfStock !== undefined) {
            out_of_stock = scrapeResult.data.outOfStock;
          }
          console.log("✅ [API] Scrape successful:", title, "Price:", currentPrice, "OOS:", out_of_stock);
          
          const hasGoodTitle = title && title.length > 10 && title !== 'New Item';
          const hasImage = !!image_url;
          scrapeQuality = (hasGoodTitle && hasImage) ? 'good' : 'poor';
        } else {
          const errorMsg = scrapeResult?.error || scrapeResult?.detail || 'Unknown error';
          console.warn("⚠️ [API] Server scrape failed (non-fatal):", errorMsg);
          title = title || 'New Item';
          currentPrice = price ? (cleanPriceValue(price.toString()) || 0) : 0;
        }
      } catch (err: any) {
        console.warn("⚠️ [API] Server scrape failed (non-fatal):", err.message);
        title = title || 'New Item';
        currentPrice = price ? (cleanPriceValue(price.toString()) || 0) : 0;
      }
      
      // If scrape quality is poor (no real title or image), queue the item
      // so the extension can scrape it properly later
      if (scrapeQuality === 'poor' && !status) {
        status = 'queued';
        console.log("📋 [API] Poor scrape result, saving as queued for extension scrape later");
      }
    } else {
      return NextResponse.json(
        { error: 'Please provide either (title + price) or a valid URL to scrape.' },
        { status: 400, headers: corsHeaders(origin) }
      );
    }

    // 5. Ensure Profile Exists
    if (!supabaseClient) {
      return NextResponse.json(
        { error: 'Database client not initialized' },
        { status: 500, headers: corsHeaders(origin) }
      );
    }

    const { data: profile } = await supabaseClient
      .from('profiles')
      .select('id')
      .eq('id', user.id)
      .single();

    if (!profile) {
      await supabaseClient.from('profiles').insert({
        id: user.id,
        username: user.email?.split('@')[0] || 'user',
        full_name: user.user_metadata?.full_name || '',
        avatar_url: user.user_metadata?.avatar_url || ''
      });
    }

    // 6. Find or Create Wishlist
    let { data: wishlists } = await supabaseClient
      .from('wishlists')
      .select('id')
      .eq('user_id', user.id)
      .limit(1);

    let wishlistId;
    if (!wishlists || wishlists.length === 0) {
      const { data: newWishlist, error: createError } = await supabaseClient
        .from('wishlists')
        .insert({ 
          user_id: user.id, 
          title: 'My Wishlist', 
          visibility: 'private' 
        })
        .select()
        .single();
      
      if (createError) throw createError;
      wishlistId = newWishlist.id;
    } else {
      wishlistId = wishlists[0].id;
    }

    // 6b. Hidden folder: only when client sends save_hidden: true (new extension).
    // Do not use is_public — older extensions default is_public:false and would hide every item.
    let effectiveStatus: string =
      typeof status === 'string' && status.length > 0 ? status : 'active';
    if (save_hidden === true) {
      effectiveStatus = 'hidden';
    }

    // Check item limit for active items only (hidden/queued don't count toward cap)
    if (effectiveStatus === 'active') {
      const limitCheck = await checkItemLimitForApi(user.id, supabaseClient, client_tier);
      if (!limitCheck.allowed) {
        return NextResponse.json(
          { error: 'Item limit reached', limit: limitCheck.limit, current: limitCheck.current, upgrade: true },
          { status: 403, headers: corsHeaders(origin) }
        );
      }
    }

    // 7. Convert foreign currency to USD before storing
    const sourceCurrency = currency || 'USD';
    let storedPrice = currentPrice;
    if (sourceCurrency !== 'USD' && currentPrice > 0) {
      try {
        const { converted } = await convertPrice(currentPrice, sourceCurrency, 'USD');
        console.log(`💱 [API] Converted ${sourceCurrency} ${currentPrice} → USD ${converted}`);
        storedPrice = converted;
      } catch (e: any) {
        console.warn('⚠️ [API] Currency conversion failed, storing original:', e.message);
      }
    }

    const insertData: any = {
        title,
        current_price: storedPrice,
        url,
        image_url,
        retailer: retailer || 'Amazon',
        status: effectiveStatus,
        user_id: user.id,
        wishlist_id: wishlistId,
        original_currency: sourceCurrency,
        out_of_stock: out_of_stock === true,
    };

    // Add collection_id if provided
    if (collection_id) {
      // Verify collection belongs to user
      const { data: collection } = await supabaseClient
        .from('collections')
        .select('id')
        .eq('id', collection_id)
        .eq('user_id', user.id)
        .single();
      
      if (collection) {
        insertData.collection_id = collection_id;
      } else {
        console.warn("⚠️ [API] Collection not found or doesn't belong to user, ignoring collection_id");
      }
    }

    const { data, error } = await supabaseClient
      .from('items')
      .insert(insertData)
      .select()
      .single();

    if (error) {
      console.error("❌ DB Error:", error);
      return NextResponse.json(
        { error: error.message },
        { status: 500, headers: corsHeaders(origin) }
      );
    }

    // 8. Insert Price History (if price exists) — use USD-converted price
    if (storedPrice > 0) {
      await supabaseClient.from('price_history').insert({
        item_id: data.id,
        price: storedPrice
      });
    }

    console.log("✅ Item saved:", data.id);
    return NextResponse.json(
      { success: true, item: data },
      { headers: corsHeaders(origin) }
    );

  } catch (error: any) {
    console.error('❌ Server Error:', error);
    return NextResponse.json(
      { error: error.message || 'Server Error' },
      { status: 500, headers: corsHeaders(origin) }
    );
  }
}

export async function DELETE(request: Request) {
  const origin = request.headers.get('origin');

  try {
    // 1. Grab the Bearer Token from the Header
    const authHeader = request.headers.get('Authorization');
    let user = null;
    let supabase;

    if (authHeader) {
      const token = authHeader.replace('Bearer ', '');
      
      // 2. Initialize RAW Supabase Client with the token (No Next.js magic)
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
      const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
      supabase = createClient(supabaseUrl, supabaseKey, {
        global: {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      });

      // 3. Verify the token directly with Supabase
      const { data, error } = await supabase.auth.getUser(token);
      if (data.user) {
        user = data.user;
        console.log("✅ Verified User via Raw SDK:", user.email);
      } else {
        console.error("❌ Token Verification Failed:", error);
      }
    }

    // 4. Fail if no user
    if (!user || !supabase) {
      return NextResponse.json(
        { error: 'Unauthorized. Please log in to Wist.' },
        { status: 401, headers: corsHeaders(origin) }
      );
    }

    // 5. Perform Delete
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'Item ID is required' },
        { status: 400, headers: corsHeaders(origin) }
      );
    }

    const { error } = await supabase
      .from('items')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id);

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500, headers: corsHeaders(origin) }
      );
    }

    return NextResponse.json({ success: true }, { headers: corsHeaders(origin) });

  } catch (error: any) {
    console.error('❌ Server Error:', error);
    return NextResponse.json(
      { error: error.message || 'Server Error' },
      { status: 500, headers: corsHeaders(origin) }
    );
  }
}

export async function PATCH(request: Request) {
  const origin = request.headers.get('origin');

  try {
    const body = await request.json();
    const { id, title, price, image_url, status: newStatus, client_tier, out_of_stock: patchOos, url: patchUrl } = body;

    if (!id) {
      return NextResponse.json(
        { error: 'Item ID is required' },
        { status: 400, headers: corsHeaders(origin) }
      );
    }

    // Auth: try cookie then bearer
    let user = null;
    let supabaseClient = null;

    const cookieHeader = request.headers.get('cookie') || '';
    const cookieMap = new Map<string, string>();
    if (cookieHeader) {
      cookieHeader.split(';').forEach(cookie => {
        const [name, ...valueParts] = cookie.trim().split('=');
        if (name && valueParts.length > 0) {
          cookieMap.set(name.trim(), valueParts.join('='));
        }
      });
    }

    if (cookieMap.size > 0) {
      const response = NextResponse.next();
      supabaseClient = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
          cookies: {
            getAll() {
              return Array.from(cookieMap.entries()).map(([name, value]) => ({ name, value }));
            },
            setAll(cookiesToSet) {
              cookiesToSet.forEach(({ name, value, options }) => {
                cookieMap.set(name, value);
                response.cookies.set(name, value, options);
              });
            },
          },
        }
      );
      const cookieAuth = await supabaseClient.auth.getUser();
      if (cookieAuth.data?.user) {
        user = cookieAuth.data.user;
      }
    }

    if (!user) {
      const authHeader = request.headers.get('Authorization');
      if (authHeader?.startsWith('Bearer ')) {
        const token = authHeader.replace('Bearer ', '').trim();
        if (token && token !== 'undefined' && token !== 'null') {
          const supabaseWithToken = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
            { auth: { persistSession: false, autoRefreshToken: false }, global: { headers: { Authorization: `Bearer ${token}` } } }
          );
          const { data: { user: tokenUser } } = await supabaseWithToken.auth.getUser();
          if (tokenUser) {
            user = tokenUser;
            supabaseClient = supabaseWithToken;
          }
        }
      }
    }

    if (!user || !supabaseClient) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401, headers: corsHeaders(origin) }
      );
    }

    if (newStatus === 'active') {
      const limitCheck = await checkItemLimitForApi(user.id, supabaseClient, client_tier);
      if (!limitCheck.allowed) {
        return NextResponse.json(
          { error: 'Item limit reached', limit: limitCheck.limit, current: limitCheck.current, upgrade: true },
          { status: 403, headers: corsHeaders(origin) }
        );
      }
    }

    const updateData: any = {};
    if (title !== undefined) updateData.title = title;
    if (price !== undefined) updateData.current_price = cleanPriceValue(price.toString()) || 0;
    if (image_url !== undefined) updateData.image_url = image_url;
    if (patchUrl !== undefined) {
      const u = String(patchUrl).trim();
      if (!u) {
        return NextResponse.json(
          { error: 'Product URL cannot be empty' },
          { status: 400, headers: corsHeaders(origin) }
        );
      }
      const withScheme = /^https?:\/\//i.test(u) ? u : `https://${u}`;
      try {
        const parsed = new URL(withScheme);
        if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
          return NextResponse.json(
            { error: 'Invalid product URL' },
            { status: 400, headers: corsHeaders(origin) }
          );
        }
        updateData.url = withScheme;
        updateData.retailer = parsed.hostname.replace('www.', '').split('.')[0];
      } catch {
        return NextResponse.json(
          { error: 'Invalid product URL' },
          { status: 400, headers: corsHeaders(origin) }
        );
      }
    }
    if (newStatus !== undefined) {
      updateData.status = newStatus;
      if (newStatus === 'active') updateData.out_of_stock = patchOos === true;
    }

    const { data, error } = await supabaseClient
      .from('items')
      .update(updateData)
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single();

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500, headers: corsHeaders(origin) }
      );
    }

    // If upgrading from queued to active and now has a price, add price history
    if (newStatus === 'active' && updateData.current_price > 0) {
      await supabaseClient.from('price_history').insert({
        item_id: id,
        price: updateData.current_price
      });
    }

    return NextResponse.json(
      { success: true, item: data },
      { headers: corsHeaders(origin) }
    );
  } catch (error: any) {
    console.error('❌ PATCH Error:', error);
    return NextResponse.json(
      { error: error.message || 'Server Error' },
      { status: 500, headers: corsHeaders(origin) }
    );
  }
}