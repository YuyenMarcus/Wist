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
    // --- DEBUGGING ENV VARS ---
    const hasUrl = !!process.env.NEXT_PUBLIC_SUPABASE_URL;
    const hasAnon = !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const hasService = !!process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    console.log(`🔍 SERVER ENV CHECK: URL=${hasUrl}, ANON=${hasAnon}, SERVICE_ROLE=${hasService}`);
    
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      console.error("❌ CRITICAL: SUPABASE_SERVICE_ROLE_KEY is undefined on the server.");
      return NextResponse.json(
        { error: 'Server configuration error: Missing Service Key. Please add SUPABASE_SERVICE_ROLE_KEY to your environment variables.' },
        { status: 500, headers: corsHeaders(origin) }
      );
    }
    // ---------------------------

    // 1. Get Auth Token and Verify User
    const authHeader = request.headers.get('Authorization');
    const token = authHeader?.replace('Bearer ', '');
    
    if (!token) {
      return NextResponse.json(
        { error: 'No Token' },
        { status: 401, headers: corsHeaders(origin) }
      );
    }

    // Verify User (Security Check)
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

    // 2. CREATE ADMIN CLIENT (The "Nuclear" Fix)
    // We use the Service Role Key here to BYPASS RLS entirely.
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // 3. Get ID
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id || id === 'undefined' || id === 'null') {
      return NextResponse.json(
        { error: 'Missing Item ID' },
        { status: 400, headers: corsHeaders(origin) }
      );
    }

    const cleanId = id.trim();
    console.log(`🕵️ ADMIN DEBUG: Force deleting Item [${cleanId}] for User [${user.id}]`);

    // 4. Debug: Check if item exists and who owns it BEFORE deleting
    const { data: itemToCheck, error: checkError } = await supabaseAdmin
      .from('items')
      .select('user_id')
      .eq('id', cleanId)
      .single();

    if (checkError || !itemToCheck) {
      console.error("❌ ADMIN CHECK: Item ID does not exist in DB at all.", checkError?.message);
      return NextResponse.json(
        { error: 'Item not found in DB' },
        { status: 404, headers: corsHeaders(origin) }
      );
    }

    if (itemToCheck.user_id !== user.id) {
      console.error(`⚠️ OWNERSHIP MISMATCH: Item belongs to [${itemToCheck.user_id}], but User [${user.id}] is trying to delete it.`);
      return NextResponse.json(
        { error: 'You do not own this item' },
        { status: 403, headers: corsHeaders(origin) }
      );
    }

    // 5. Force Delete
    const { error, count } = await supabaseAdmin
      .from('items')
      .delete({ count: 'exact' })
      .eq('id', cleanId);

    if (error) {
      console.error("❌ DB Error:", error.message);
      return NextResponse.json(
        { error: error.message },
        { status: 500, headers: corsHeaders(origin) }
      );
    }

    if (!count || count === 0) {
      console.error("⚠️ ADMIN DELETE: Count was 0, but item exists. This should not happen.");
      return NextResponse.json(
        { error: 'Delete operation returned 0 rows' },
        { status: 500, headers: corsHeaders(origin) }
      );
    }

    console.log(`✅ SUCCESS: Admin deleted item [${cleanId}]. Count: ${count}`);
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

