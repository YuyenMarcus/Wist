import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

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

export async function DELETE(request: Request) {
  const origin = request.headers.get('origin');

  try {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader) {
      return NextResponse.json(
        { error: 'No Token' },
        { status: 401, headers: corsHeaders(origin) }
      );
    }

    const token = authHeader.replace('Bearer ', '');

    // 1. Verify User (Security Check)
    const supabaseAuth = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401, headers: corsHeaders(origin) }
      );
    }

    // 2. Get ID
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id || id === 'undefined' || id === 'null') {
      return NextResponse.json(
        { error: 'Missing Item ID' },
        { status: 400, headers: corsHeaders(origin) }
      );
    }

    // 3. Use Service Role Key to BYPASS RLS and force delete
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceKey) {
      console.error("❌ Missing SUPABASE_SERVICE_ROLE_KEY");
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500, headers: corsHeaders(origin) }
      );
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      serviceKey
    );

    console.log(`🗑️ DELETE: User [${user.id}] deleting Item [${id}]`);

    // 4. First, check if item exists and who owns it (for debugging)
    const { data: itemCheck } = await supabaseAdmin
      .from('items')
      .select('id, user_id, title, url')
      .eq('id', id)
      .maybeSingle();

    if (itemCheck) {
      console.log(`🔍 Item found: Title="${itemCheck.title}", Owner=${itemCheck.user_id}, Requesting User=${user.id}`);
      if (itemCheck.user_id !== user.id) {
        console.log(`❌ Ownership mismatch: Item belongs to ${itemCheck.user_id}, but ${user.id} is trying to delete it`);
        return NextResponse.json(
          { success: false, message: "You don't own this item" },
          { status: 403, headers: corsHeaders(origin) }
        );
      }
    } else {
      // Item doesn't exist in items table - check if it's in products table (legacy)
      const { data: productCheck } = await supabaseAdmin
        .from('products')
        .select('id, user_id, title, url')
        .eq('id', id)
        .maybeSingle();
      
      if (productCheck) {
        console.log(`⚠️ Item found in products table (legacy), not items table. ID=${id}`);
        return NextResponse.json(
          { success: false, message: "This item is in the legacy products table. Please refresh your dashboard." },
          { status: 404, headers: corsHeaders(origin) }
        );
      } else {
        console.log(`❌ Item [${id}] does not exist in either items or products table`);
        return NextResponse.json(
          { success: false, message: "Item not found" },
          { status: 404, headers: corsHeaders(origin) }
        );
      }
    }

    // 5. Delete ONLY from items table (user's personal wishlist link)
    // This follows the "Unlink" strategy:
    // - We delete the user's link to the product (items table)
    // - We NEVER delete from products table (global catalog stays intact)
    // - Other users can still have the same product in their wishlist
    const { error, count } = await supabaseAdmin
      .from('items')
      .delete({ count: 'exact' })
      .eq('id', id)
      .eq('user_id', user.id); // Ensure user owns this item

    if (error) {
      console.error("❌ DB Error:", error.message);
      return NextResponse.json(
        { error: error.message },
        { status: 500, headers: corsHeaders(origin) }
      );
    }

    // 6. Verify deletion succeeded
    if (!count || count === 0) {
      console.log(`⚠️ Delete count 0. Item [${id}] deletion failed unexpectedly`);
      return NextResponse.json(
        { success: false, message: "Failed to delete item" },
        { status: 500, headers: corsHeaders(origin) }
      );
    }

    console.log(`✅ SUCCESS: Unlinked item [${id}] from user [${user.id}] (product remains in catalog)`);
    return NextResponse.json(
      { success: true, count },
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

