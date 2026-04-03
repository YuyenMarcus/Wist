export const dynamic = 'force-dynamic';

import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
import { NextResponse } from 'next/server';
import { authenticateRequest, getCollectionRole, generateInviteCode } from '@/lib/collections/auth';
import { getServiceRoleSupabase } from '@/lib/supabase/service-role';

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

    // Fetch own collections
    const { data: ownCollections, error } = await supabaseClient
      .from('collections')
      .select('id, name, slug, icon, color, created_at, position, registry_mode, background_image_url, collaborative_enabled, collaboration_invite_code')
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

    // Fetch shared collections (where user is a collaborator)
    let sharedCollections: any[] = [];
    try {
      const { getServiceRoleSupabase } = await import('@/lib/supabase/service-role');
      const admin = getServiceRoleSupabase();
      const { data: collabs } = await admin
        .from('collection_collaborators')
        .select('collection_id, role')
        .eq('user_id', user.id);

      if (collabs && collabs.length > 0) {
        const collabIds = collabs.map(c => c.collection_id);
        const roleMap = new Map(collabs.map(c => [c.collection_id, c.role]));

        const { data: shared } = await admin
          .from('collections')
          .select('id, name, slug, icon, color, created_at, position, registry_mode, background_image_url, collaborative_enabled, collaboration_invite_code, user_id')
          .in('id', collabIds);

        if (shared) {
          sharedCollections = shared.map(c => ({
            ...c,
            is_owner: false,
            role: roleMap.get(c.id) || 'editor',
          }));
        }
      }
    } catch (e) {
      console.warn('[Collections API] Shared collections fetch failed:', e);
    }

    const owned = (ownCollections || []).map(c => ({ ...c, is_owner: true, role: 'owner' }));

    return NextResponse.json(
      { success: true, collections: [...owned, ...sharedCollections] },
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

export async function PATCH(request: Request) {
  const origin = request.headers.get('origin');

  try {
    const auth = await authenticateRequest(request);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders(origin) });
    }

    const body = await request.json();
    const {
      id,
      name,
      icon,
      color,
      registry_mode,
      background_image_url,
      collaborative_enabled,
    } = body;

    if (!id) {
      return NextResponse.json({ error: 'Collection id required' }, { status: 400, headers: corsHeaders(origin) });
    }

    const { role } = await getCollectionRole(id, auth.userId);
    if (role !== 'owner') {
      return NextResponse.json({ error: 'Only the owner can update this collection' }, { status: 403, headers: corsHeaders(origin) });
    }

    const admin = getServiceRoleSupabase();

    if (collaborative_enabled !== undefined) {
      if (collaborative_enabled === true) {
        const { data: col } = await admin
          .from('collections')
          .select('collaboration_invite_code')
          .eq('id', id)
          .maybeSingle();

        let code = col?.collaboration_invite_code?.trim() || null;
        if (!code) {
          let newCode: string | null = null;
          for (let attempt = 0; attempt < 24; attempt++) {
            const candidate = generateInviteCode();
            const [{ data: clashInvite }, { data: clashCol }] = await Promise.all([
              admin.from('collection_invites').select('id').eq('invite_code', candidate).maybeSingle(),
              admin.from('collections').select('id').eq('collaboration_invite_code', candidate).maybeSingle(),
            ]);
            if (!clashInvite && !clashCol) {
              newCode = candidate;
              break;
            }
          }
          if (!newCode) {
            return NextResponse.json(
              { error: 'Could not generate a unique invite code' },
              { status: 500, headers: corsHeaders(origin) }
            );
          }
          const { error: insErr } = await admin.from('collection_invites').insert({
            collection_id: id,
            invite_code: newCode,
            created_by: auth.userId,
            max_uses: null,
            expires_at: null,
          });
          if (insErr) {
            return NextResponse.json({ error: insErr.message }, { status: 500, headers: corsHeaders(origin) });
          }
          code = newCode;
        }

        const { error: upErr } = await admin
          .from('collections')
          .update({ collaborative_enabled: true, collaboration_invite_code: code })
          .eq('id', id);
        if (upErr) {
          return NextResponse.json({ error: upErr.message }, { status: 500, headers: corsHeaders(origin) });
        }
      } else {
        await admin.from('collection_invites').delete().eq('collection_id', id);
        await admin.from('collection_collaborators').delete().eq('collection_id', id);
        const { error: offErr } = await admin
          .from('collections')
          .update({ collaborative_enabled: false, collaboration_invite_code: null })
          .eq('id', id);
        if (offErr) {
          return NextResponse.json({ error: offErr.message }, { status: 500, headers: corsHeaders(origin) });
        }
      }
    }

    const updateData: Record<string, unknown> = {};
    if (name !== undefined) updateData.name = name;
    if (icon !== undefined) updateData.icon = icon;
    if (color !== undefined) updateData.color = color;
    if (registry_mode !== undefined) updateData.registry_mode = registry_mode;
    if (background_image_url !== undefined) updateData.background_image_url = background_image_url;

    if (Object.keys(updateData).length > 0) {
      const { error } = await admin.from('collections').update(updateData).eq('id', id);
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500, headers: corsHeaders(origin) });
      }
    }

    if (
      collaborative_enabled === undefined &&
      Object.keys(updateData).length === 0
    ) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400, headers: corsHeaders(origin) });
    }

    const { data, error: selErr } = await admin.from('collections').select().eq('id', id).maybeSingle();
    if (selErr || !data) {
      return NextResponse.json(
        { error: selErr?.message || 'Collection not found' },
        { status: 500, headers: corsHeaders(origin) }
      );
    }

    return NextResponse.json({ success: true, collection: data }, { headers: corsHeaders(origin) });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Server Error' },
      { status: 500, headers: corsHeaders(origin) }
    );
  }
}
