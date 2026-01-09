export const dynamic = 'force-dynamic';

import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
import { NextResponse } from 'next/server';

// HELPER: Dynamic CORS Headers
function corsHeaders(origin: string | null) {
  return {
    'Access-Control-Allow-Origin': origin || '*',
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization',
  };
}

// Handle OPTIONS (Pre-flight check for CORS)
export async function OPTIONS(request: Request) {
  const origin = request.headers.get('origin');
  return NextResponse.json({}, { status: 200, headers: corsHeaders(origin) });
}

export async function GET(request: Request) {
  const origin = request.headers.get('origin');

  try {
    // Authentication
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
      }
    }

    // If no cookie, check Bearer token (for extension)
    if (!user) {
      const authHeader = request.headers.get('Authorization');
      
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.replace('Bearer ', '').trim();
        
        if (!token || token === 'undefined' || token === 'null') {
          return NextResponse.json(
            { error: 'Invalid token. Please log in to Wist.' },
            { status: 401, headers: corsHeaders(origin) }
          );
        }

        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
        
        if (!supabaseUrl || !supabaseAnonKey) {
          return NextResponse.json({ 
            error: 'Server configuration error' 
          }, { status: 500, headers: corsHeaders(origin) });
        }
        
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
        
        const { data: { user: tokenUser }, error: tokenError } = await supabaseWithToken.auth.getUser();
        
        if (tokenError || !tokenUser) {
          return NextResponse.json({ 
            error: 'Token verification failed. Please log in again.',
            details: tokenError?.message
          }, { status: 401, headers: corsHeaders(origin) });
        }
        
        user = tokenUser;
        supabaseClient = supabaseWithToken;
      }
    }

    // Final auth check
    if (!user || !supabaseClient) {
      return NextResponse.json({ 
        error: 'Unauthorized. Please log in.',
        details: 'No valid session or token found'
      }, { status: 401, headers: corsHeaders(origin) });
    }

    // Fetch collections
    const { data: collections, error } = await supabaseClient
      .from('collections')
      .select('id, name, slug, icon, color, created_at, position')
      .eq('user_id', user.id)
      .order('position', { ascending: true, nullsFirst: false })
      .order('created_at', { ascending: true });

    if (error) {
      console.error("❌ [Collections API] Error:", error);
      return NextResponse.json(
        { error: error.message },
        { status: 500, headers: corsHeaders(origin) }
      );
    }

    return NextResponse.json(
      { success: true, collections: collections || [] },
      { headers: corsHeaders(origin) }
    );

  } catch (error: any) {
    console.error('❌ [Collections API] Server Error:', error);
    return NextResponse.json(
      { error: error.message || 'Server Error' },
      { status: 500, headers: corsHeaders(origin) }
    );
  }
}
