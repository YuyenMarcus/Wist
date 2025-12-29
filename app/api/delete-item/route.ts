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
    // 1. Get the Auth Token from the request headers
    const authHeader = request.headers.get('Authorization');
    
    if (!authHeader) {
      return NextResponse.json(
        { error: 'Missing Authorization Header' },
        { status: 401, headers: corsHeaders(origin) }
      );
    }

    const token = authHeader.replace('Bearer ', '');

    // 2. Create a Supabase Client that acts AS THE USER
    // We pass the token in the 'global.headers' so every DB query carries their ID.
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        global: {
          headers: { Authorization: `Bearer ${token}` },
        },
      }
    );

    // 3. Verify the User (Double check)
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      console.error("❌ Auth Failed:", authError?.message);
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401, headers: corsHeaders(origin) }
      );
    }

    // 4. Get the Item ID to delete
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id || id === 'undefined' || id === 'null') {
      return NextResponse.json(
        { error: 'Missing Item ID' },
        { status: 400, headers: corsHeaders(origin) }
      );
    }

    const cleanId = id.trim();
    console.log(`🕵️ DEBUG: User [${user.id}] deleting Item [${cleanId}]`);

    // 5. Perform the Delete
    // We don't need .eq('user_id', user.id) because RLS handles it, 
    // but keeping it is a good safety double-check.
    const { data, error, count } = await supabase
      .from('items')
      .delete({ count: 'exact' })
      .eq('id', cleanId)
      .eq('user_id', user.id); 

    if (error) {
      console.error("❌ DB Error:", error.message);
      return NextResponse.json(
        { error: error.message },
        { status: 500, headers: corsHeaders(origin) }
      );
    }

    // 6. Verify Success
    if (!count || count === 0) {
      console.error(`⚠️ FAILED: Item [${cleanId}] was not deleted. RLS or ID mismatch.`);
      return NextResponse.json(
        { success: false, message: "Item not found or RLS blocked delete" },
        { status: 404, headers: corsHeaders(origin) }
      );
    }

    console.log(`✅ SUCCESS: Deleted item [${cleanId}]`);
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

