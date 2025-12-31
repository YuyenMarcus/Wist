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

    // 4. Try deleting from items table first
    let { error, count } = await supabaseAdmin
      .from('items')
      .delete({ count: 'exact' })
      .eq('id', id)
      .eq('user_id', user.id);

    // 5. If not found in items, try products table
    if (!count || count === 0) {
      console.log(`⚠️ Item not found in items table, trying products table...`);
      const productsResult = await supabaseAdmin
        .from('products')
        .delete({ count: 'exact' })
        .eq('id', id)
        .eq('user_id', user.id);
      
      if (productsResult.error) {
        error = productsResult.error;
      } else {
        count = productsResult.count;
      }
    }

    if (error) {
      console.error("❌ DB Error:", error.message);
      return NextResponse.json(
        { error: error.message },
        { status: 500, headers: corsHeaders(origin) }
      );
    }

    // 6. Verify
    if (!count || count === 0) {
      console.log(`⚠️ Delete count 0. Item [${id}] not found or not owned by user [${user.id}]`);
      return NextResponse.json(
        { success: false, message: "Item not found or not owned by you" },
        { status: 404, headers: corsHeaders(origin) }
      );
    }

    console.log(`✅ SUCCESS: Deleted item [${id}]`);
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

