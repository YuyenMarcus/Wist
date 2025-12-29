export const dynamic = 'force-dynamic'; // Force dynamic rendering to prevent caching that ignores cookies

import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { scrapeProduct } from '@/lib/scraper';

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
    let { title, price, url, image_url, status, retailer } = body;

    console.log("📥 Incoming Item Request:", { url, hasTitle: !!title, hasPrice: !!price });

    // 2. Check Auth - Try Authorization header first (for extensions), then cookies (for dashboard)
    const authHeader = request.headers.get('Authorization');
    let supabase;
    let user;

    if (authHeader) {
      // Extension/API Key auth
      const token = authHeader.replace('Bearer ', '');
      supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
          global: {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          },
        }
      );
      
      const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();
      if (authError || !authUser) {
        return NextResponse.json(
          { error: 'Unauthorized. Please log in to Wist.' },
          { status: 401, headers: corsHeaders(origin) }
        );
      }
      user = authUser;
    } else {
      // Cookie-based auth for dashboard requests
      // Read cookies directly from request headers (middleware should have refreshed them)
      const cookieHeader = request.headers.get('cookie') || '';
      
      // Create response object to set cookies if needed
      const response = NextResponse.next();
      
      // Parse cookies from header
      const cookieMap = new Map<string, string>();
      if (cookieHeader) {
        cookieHeader.split(';').forEach(cookie => {
          const [name, ...valueParts] = cookie.trim().split('=');
          if (name && valueParts.length > 0) {
            cookieMap.set(name.trim(), valueParts.join('='));
          }
        });
      }
      
      supabase = createServerClient(
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
      
      const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();
      
      if (authError || !authUser) {
        console.log("❌ Auth Failed in POST:", authError);
        return NextResponse.json(
          { error: 'Unauthorized. Please log in to Wist.' },
          { status: 401, headers: corsHeaders(origin) }
        );
      }
      user = authUser;
    }

    // 3. DECISION: Do we trust the input, or do we need to scrape?
    let currentPrice = 0;

    if (title && price) {
      // A. TRUST MODE (Extension sent the data)
      // Clean the price string (e.g. "$29.99" -> 29.99)
      currentPrice = parseFloat(price.toString().replace(/[^0-9.]/g, '')) || 0;
      console.log("✅ Using provided data (Title & Price)");
    } else if (url && (!title || !price)) {
      // B. SCRAPE MODE (Dashboard only sent a URL, or price/title missing)
      console.log("🕵️ Scraping URL for missing data...");
      try {
        const scrapedData = await scrapeProduct(url);
        
        if (!scrapedData) {
          return NextResponse.json(
            { error: 'Failed to scrape product. Please provide title and price.' },
            { status: 400, headers: corsHeaders(origin) }
          );
        }

        // Use scraped data to fill in missing fields
        title = title || scrapedData.title;
        currentPrice = price ? parseFloat(price.toString().replace(/[^0-9.]/g, '')) : (scrapedData.current_price || 0);
        image_url = image_url || scrapedData.image_url;
        retailer = retailer || scrapedData.retailer;
        // If scraping, we assume status is active (wishlist) unless specified
        status = status || 'active';
        
        console.log("✅ Scrape Successful:", title, "Price:", currentPrice);
      } catch (err: any) {
        console.error("Scraping Error:", err);
        return NextResponse.json(
          { error: `Scraping failed: ${err.message}` },
          { status: 500, headers: corsHeaders(origin) }
        );
      }
    } else {
      return NextResponse.json(
        { error: 'Please provide either (title + price) or a valid URL to scrape.' },
        { status: 400, headers: corsHeaders(origin) }
      );
    }

    // 4. Ensure Profile Exists
    const { data: profile } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', user.id)
      .single();

    if (!profile) {
      await supabase.from('profiles').insert({
        id: user.id,
        username: user.email?.split('@')[0] || 'user',
        full_name: user.user_metadata?.full_name || '',
        avatar_url: user.user_metadata?.avatar_url || ''
      });
    }

    // 5. Find or Create Wishlist
    let { data: wishlists } = await supabase
      .from('wishlists')
      .select('id')
      .eq('user_id', user.id)
      .limit(1);

    let wishlistId;
    if (!wishlists || wishlists.length === 0) {
      const { data: newWishlist, error: createError } = await supabase
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

    // 6. Insert Item with status field
    const { data, error } = await supabase
      .from('items')
      .insert({
        title,
        current_price: currentPrice,
        url,
        image_url,
        retailer: retailer || 'Amazon',
        status: status || 'active', // 'active' (Wishlist) or 'purchased' (Just Got It)
        user_id: user.id,
        wishlist_id: wishlistId
      })
      .select()
      .single();

    if (error) {
      console.error("❌ DB Error:", error);
      return NextResponse.json(
        { error: error.message },
        { status: 500, headers: corsHeaders(origin) }
      );
    }

    // 7. Insert Price History (if price exists)
    if (currentPrice > 0) {
      await supabase.from('price_history').insert({
        item_id: data.id,
        price: currentPrice
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