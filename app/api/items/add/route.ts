import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

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
    let { url, title, price, image_url, retailer, description } = body;

    // 5. CHECK: Does this URL already exist in products table?
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
        // Use existing product data to fill in missing fields
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

    // 8. Insert Item into items table (user's personal wishlist)
    // This allows multiple users to have the same product in their wishlist
    // Even if the product already exists in the products catalog
    const { data: newItem, error: itemError } = await supabase
      .from('items')
      .insert({
        user_id: user.id,
        url,
        title,
        current_price: price ? parseFloat(price.toString().replace(/[^0-9.]/g, '')) : 0,
        image_url,
        retailer: retailer || 'Amazon',
        status: 'active', // Default to active (wishlist)
        note: description ? description.substring(0, 100) : null,
        wishlist_id: wishlistId
      })
      .select()
      .single();

    if (itemError) throw itemError;

    // 9. Insert Price History
    if (price) {
      await supabase.from('price_history').insert({
        item_id: newItem.id,
        price: price
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
