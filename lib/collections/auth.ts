import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
import { getServiceRoleSupabase } from '@/lib/supabase/service-role';

export interface CollectionAuthResult {
  userId: string;
  supabase: any;
}

/**
 * Authenticate a request via cookies or Bearer token.
 * Returns the user ID and an appropriate Supabase client.
 */
export async function authenticateRequest(request: Request): Promise<CollectionAuthResult | null> {
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
    const supabaseClient = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return Array.from(cookieMap.entries()).map(([name, value]) => ({ name, value }));
          },
          setAll() {},
        },
      }
    );
    const { data } = await supabaseClient.auth.getUser();
    if (data?.user) {
      return { userId: data.user.id, supabase: supabaseClient };
    }
  }

  const authHeader = request.headers.get('Authorization');
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.replace('Bearer ', '').trim();
    if (token && token !== 'undefined' && token !== 'null') {
      const supabaseWithToken = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
          auth: { persistSession: false, autoRefreshToken: false },
          global: { headers: { Authorization: `Bearer ${token}` } },
        }
      );
      const { data } = await supabaseWithToken.auth.getUser();
      if (data?.user) {
        return { userId: data.user.id, supabase: supabaseWithToken };
      }
    }
  }

  return null;
}

/**
 * Check if a user owns a collection or is a collaborator.
 * Returns the role ('owner' | 'editor') or null.
 */
export async function getCollectionRole(
  collectionId: string,
  userId: string
): Promise<{ role: 'owner' | 'editor' | null; ownerId: string | null }> {
  const admin = getServiceRoleSupabase();

  const { data: collection } = await admin
    .from('collections')
    .select('user_id')
    .eq('id', collectionId)
    .maybeSingle();

  if (!collection) return { role: null, ownerId: null };

  if (collection.user_id === userId) {
    return { role: 'owner', ownerId: collection.user_id };
  }

  const { data: collab } = await admin
    .from('collection_collaborators')
    .select('role')
    .eq('collection_id', collectionId)
    .eq('user_id', userId)
    .maybeSingle();

  if (collab) {
    return { role: collab.role as 'editor', ownerId: collection.user_id };
  }

  return { role: null, ownerId: collection.user_id };
}

export function generateInviteCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

export function generateReserverToken(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let token = '';
  for (let i = 0; i < 24; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return token;
}
