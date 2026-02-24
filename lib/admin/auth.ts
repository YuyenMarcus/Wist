import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

/**
 * Verify the request comes from an admin user.
 * Returns the admin's user ID or null if not admin.
 */
export async function verifyAdmin(request: Request): Promise<string | null> {
  try {
    const cookieHeader = request.headers.get('cookie') || '';
    const cookieMap = new Map<string, string>();
    cookieHeader.split(';').forEach(cookie => {
      const [name, ...valueParts] = cookie.trim().split('=');
      if (name && valueParts.length > 0) {
        cookieMap.set(name.trim(), valueParts.join('='));
      }
    });

    let userId: string | null = null;

    if (cookieMap.size > 0) {
      const supabaseClient = createServerClient(supabaseUrl, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
        cookies: {
          getAll() {
            return Array.from(cookieMap.entries()).map(([name, value]) => ({ name, value }));
          },
          setAll() {},
        },
      });
      const { data } = await supabaseClient.auth.getUser();
      if (data?.user) userId = data.user.id;
    }

    if (!userId) {
      const authHeader = request.headers.get('Authorization');
      if (authHeader?.startsWith('Bearer ')) {
        const token = authHeader.replace('Bearer ', '').trim();
        if (token && token !== 'undefined') {
          const supabaseWithToken = createClient(supabaseUrl, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
            global: { headers: { Authorization: `Bearer ${token}` } },
          });
          const { data } = await supabaseWithToken.auth.getUser();
          if (data?.user) userId = data.user.id;
        }
      }
    }

    if (!userId) return null;

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('is_admin')
      .eq('id', userId)
      .single();

    if (!profile?.is_admin) return null;

    return userId;
  } catch (err) {
    console.error('[Admin Auth] Error:', err);
    return null;
  }
}

export function getAdminClient() {
  return createClient(supabaseUrl, serviceRoleKey);
}
