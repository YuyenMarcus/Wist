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
    // Initialize RAW Supabase Client (No Next.js magic, no scraper imports)
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // 1. Get User
    const authHeader = request.headers.get('Authorization');
    if (!authHeader) {
      return NextResponse.json(
        { error: 'No Token' },
        { status: 401, headers: corsHeaders(origin) }
      );
    }
    
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401, headers: corsHeaders(origin) }
      );
    }

    // 2. Get ID from URL
    const { searchParams } = new URL(request.url);
    const rawId = searchParams.get('id');
    
    // 3. SANITY CHECK
    if (!rawId || rawId === 'undefined' || rawId === 'null') {
      console.error(`❌ BAD REQUEST: Received ID is "${rawId}"`);
      return NextResponse.json(
        { success: false, message: "Invalid ID provided" },
        { status: 400, headers: corsHeaders(origin) }
      );
    }

    const id = rawId.trim(); // Remove any accidental spaces
    console.log(`🗑️ Deleting Item ID: [${id}] for User: [${user.email}]`);

    // 4. Delete
    const { data, error } = await supabase
      .from('items')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id)
      .select();

    if (error) {
      console.error("❌ DB Error:", error.message);
      return NextResponse.json(
        { error: error.message },
        { status: 500, headers: corsHeaders(origin) }
      );
    }
    
    // 5. Final Verification
    if (!data || data.length === 0) {
      console.log("⚠️ Delete count was 0. Item not found or not owned.");
      return NextResponse.json(
        { success: false, message: "Item not found" },
        { status: 404, headers: corsHeaders(origin) }
      );
    }

    console.log(`✅ Successfully deleted ${data.length} item(s).`);
    return NextResponse.json(
      { success: true },
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

