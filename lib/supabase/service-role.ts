/**
 * Server-only Supabase client with the service role key.
 * Use in API routes / webhooks — never import from client.ts (browser) here.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let cached: SupabaseClient | null = null;

/** True when the server can use the service role (bypasses RLS for tier checks, webhooks, etc.). */
export function hasServiceRoleKey(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() && process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  );
}

export function getServiceRoleSupabase(): SupabaseClient {
  if (cached) return cached;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (!url) {
    throw new Error('[Supabase] NEXT_PUBLIC_SUPABASE_URL is missing');
  }
  if (!key) {
    throw new Error(
      '[Supabase] SUPABASE_SERVICE_ROLE_KEY is required for webhooks (set in Vercel → Environment Variables)'
    );
  }

  cached = createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  return cached;
}
