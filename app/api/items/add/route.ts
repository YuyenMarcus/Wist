import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { checkItemLimitForApi } from '@/lib/tier-guards';
import { convertPrice } from '@/lib/currency';
import { cleanPrice as cleanPriceValue } from '@/lib/scraper/utils';

// HELPER: Dynamic CORS Headers
function corsHeaders(origin: string | null) {
  return {
    'Access-Control-Allow-Origin': origin || '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
}

export async function OPTIONS(req: Request) {
  const origin = req.headers.get('origin');
  return NextResponse.json({}, { headers: corsHeaders(origin) });
}

export async function POST(req: Request) {
  const origin = req.headers.get('origin');

  try {
    console.log("[Wist API] Received request...");

    // 1. Get the Token from the Header
    const authHeader = req.headers.get('Authorization');
    
    if (!authHeader) {
      return NextResponse.json(
        { error: 'Missing Auth Token' }, 
        { status: 401, headers: corsHeaders(origin) }
      );
    }

    const token = authHeader.replace('Bearer ', '');

    // 2. CRITICAL FIX: Create a client SPECIFICALLY for this user
    // This passes the Access Token to Postgres, so auth.uid() works correctly
    const supabase = createClient(
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

    // 3. Verify the token is valid by asking for the user object
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      console.error("[Wist API] Token Invalid:", authError?.message);
      return NextResponse.json(
        { error: 'Invalid Token. Please log in again.' }, 
        { status: 401, headers: corsHeaders(origin) }
      );
    }

    console.log(`[Wist API] User verified: ${user.email}`);

    // 4. Parse Data
    const body = await req.json();
    let { url, title, price, image_url, retailer, description, currency, client_tier } = body;

    // 5a. DUPLICATE CHECK: reject if user already has this URL as an active item
    if (url) {
      const normalizedUrl = url.toLowerCase().trim();
      const { data: existingItem } = await supabase
        .from('items')
        .select('id, title')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .ilike('url', normalizedUrl)
        .limit(1)
        .maybeSingle();

      if (existingItem) {
        console.log("[Wist API] Duplicate URL, returning existing item:", existingItem.id);
        return NextResponse.json(
          { success: true, data: existingItem, duplicate: true },
          { headers: corsHeaders(origin) }
        );
      }
    }

    // 5b. CHECK: Does this URL already exist in products table?
    let existingProduct = null;
    if (url) {
      const { data: productData } = await supabase
        .from('products')
        .select('*')
        .eq('url', url)
        .single();
      
      if (productData) {
        existingProduct = productData;
        console.log("[Wist API] Found existing product in catalog:", productData.title);
        title = title || existingProduct.title || null;
        price = price || existingProduct.price || null;
        image_url = image_url || existingProduct.image || null;
        retailer = retailer || existingProduct.domain || 'Amazon';
      }
    }

    // 6. Ensure Profile Exists (Safe Check)
    // Now that 'supabase' is authenticated, RLS allows this query
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

    // 7. Find or Create Wishlist
    let { data: wishlists } = await supabase
      .from('wishlists')
      .select('id')
      .eq('user_id', user.id)
      .limit(1);

    let wishlistId;

    if (!wishlists || wishlists.length === 0) {
      console.log("[Wist API] Creating new wishlist...");
      const { data: newWishlist, error: createError } = await supabase
        .from('wishlists')
        .insert({ 
          user_id: user.id, 
          title: 'My Wishlist', 
          visibility: 'private' 
        })
        .select()
        .single();
      
      if (createError) {
        console.error("Wishlist Creation Failed:", createError);
        throw createError;
      }
      wishlistId = newWishlist.id;
    } else {
      wishlistId = wishlists[0].id;
    }

    // 7b. Check item limit (use service role so subscription_tier is read correctly)
    const limitCheck = await checkItemLimitForApi(user.id, supabase, client_tier);
    if (!limitCheck.allowed) {
      return NextResponse.json(
        { error: 'Item limit reached', limit: limitCheck.limit, current: limitCheck.current, upgrade: true },
        { status: 403, headers: corsHeaders(origin) }
      );
    }

    // 8. Convert foreign currency to USD before storing
    const sourceCurrency = currency || 'USD';
    let parsedPrice = price ? (cleanPriceValue(price.toString()) || 0) : 0;
    let storedPrice = parsedPrice;

    if (sourceCurrency !== 'USD' && parsedPrice > 0) {
      try {
        const { converted } = await convertPrice(parsedPrice, sourceCurrency, 'USD');
        console.log(`💱 [Add API] Converted ${sourceCurrency} ${parsedPrice} → USD ${converted}`);
        storedPrice = converted;
      } catch (e: any) {
        console.warn('⚠️ [Add API] Currency conversion failed, storing original:', e.message);
      }
    }

    const { data: newItem, error: itemError } = await supabase
      .from('items')
      .insert({
        user_id: user.id,
        url,
        title,
        current_price: storedPrice,
        image_url,
        retailer: retailer || 'Amazon',
        status: 'active',
        note: description ? description.substring(0, 100) : null,
        wishlist_id: wishlistId,
        original_currency: sourceCurrency,
      })
      .select()
      .single();

    if (itemError) throw itemError;

    // 9. Insert Price History (USD-converted price)
    if (storedPrice > 0) {
      await supabase.from('price_history').insert({
        item_id: newItem.id,
        price: storedPrice
      });
    }

    console.log("[Wist API] Success!");
    return NextResponse.json(
      { success: true, data: newItem }, 
      { headers: corsHeaders(origin) }
    );

  } catch (error: any) {
    console.error('--- SERVER ERROR ---');
    console.error(error);
    return NextResponse.json(
      { error: `Server Error: ${error.message}` }, 
      { status: 500, headers: corsHeaders(origin) }
    );
  }
}
