import { getItemLimit, type SubscriptionTier } from '@/lib/constants/subscription-tiers';
import { tryResyncTierFromStripe } from '@/lib/stripe/refresh-tier';
import { getServiceRoleSupabase, hasServiceRoleKey } from '@/lib/supabase/service-role';

export interface ItemLimitResult {
  allowed: boolean;
  limit: number | null;
  current: number;
}

const TIER_RANK: Record<SubscriptionTier, number> = {
  free: 0,
  pro: 1,
  creator: 2,
  enterprise: 3,
};

/**
 * Direct PostgREST read — bypasses supabase-js; use when tier from the client looks wrong
 * or as a second source of truth (same DB, fewer moving parts).
 */
async function fetchSubscriptionTierRest(userId: string): Promise<string | null> {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim().replace(/\/$/, '');
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!base || !key) return null;
  try {
    const res = await fetch(
      `${base}/rest/v1/profiles?id=eq.${encodeURIComponent(userId)}&select=subscription_tier`,
      {
        headers: {
          apikey: key,
          Authorization: `Bearer ${key}`,
          Accept: 'application/json',
        },
        cache: 'no-store',
      }
    );
    if (!res.ok) return null;
    const rows = (await res.json()) as { subscription_tier?: string }[];
    const v = rows?.[0]?.subscription_tier;
    if (v == null || v === '') return null;
    return typeof v === 'string' ? v : String(v);
  } catch {
    return null;
  }
}

/**
 * Use service role whenever the key is set so `profiles.subscription_tier` is always readable.
 * With JWT-only, RLS often blocks SELECT on your own row (e.g. only "public username" policies),
 * which makes tier look like `free` and enforces the free item cap incorrectly.
 */
function getClientForTierChecks(userSupabase: any) {
  if (hasServiceRoleKey()) {
    try {
      return getServiceRoleSupabase();
    } catch (e) {
      console.error('[checkItemLimit] getServiceRoleSupabase failed, falling back to JWT client:', e);
    }
  } else {
    console.warn(
      '[checkItemLimit] SUPABASE_SERVICE_ROLE_KEY is not set — item limits use the caller JWT. ' +
        'Set the service role key on the server so paid tiers (Pro/Creator) are detected reliably.'
    );
  }
  return userSupabase;
}

/**
 * For API routes: always use service role to read subscription_tier (bypasses RLS).
 * Call this instead of checkItemLimit when you're in a server route.
 * Falls back to checkItemLimit with JWT client only if service role key is not set.
 *
 * If the user hits the **free** item cap but has a `stripe_subscription_id`, we once
 * re-sync tier from Stripe (fixes stale `subscription_tier` after checkout / webhook lag).
 */
export async function checkItemLimitForApi(
  userId: string,
  fallbackSupabase?: any,
  clientTier?: string
): Promise<ItemLimitResult> {
  const first = await computeItemLimitForApi(userId, fallbackSupabase, clientTier);
  if (first.allowed) return first;

  // Whenever a user is blocked by any finite limit, attempt a Stripe re-sync.
  // This catches Creator/Pro users whose tier was incorrectly written as "free"
  // due to webhook lag, missing env vars, or price-id mapping gaps.
  if (first.limit != null) {
    const synced = await tryResyncTierFromStripe(userId);
    if (synced) {
      const second = await computeItemLimitForApi(userId, fallbackSupabase, clientTier);
      if (second.allowed) {
        console.log(
          '[checkItemLimitForApi] Re-synced subscription from Stripe; user is no longer capped.'
        );
      }
      return second;
    }
  }

  return first;
}

async function computeItemLimitForApi(
  userId: string,
  fallbackSupabase?: any,
  clientTier?: string
): Promise<ItemLimitResult> {
  if (hasServiceRoleKey()) {
    try {
      const client = getServiceRoleSupabase();
      return runLimitCheck(client, userId, fallbackSupabase, clientTier);
    } catch (e) {
      console.error('[checkItemLimitForApi] Service role failed:', e);
    }
  }
  if (fallbackSupabase) {
    return checkItemLimit(fallbackSupabase, userId, clientTier);
  }
  console.error(
    '[checkItemLimitForApi] SUPABASE_SERVICE_ROLE_KEY is not set and no fallback client. Set the key in Vercel → Environment Variables.'
  );
  return runLimitCheckWithRestFallback(userId, clientTier);
}

/** When no Supabase client exists, still evaluate limits via PostgREST if service role key is set. */
async function runLimitCheckWithRestFallback(userId: string, clientTier?: string): Promise<ItemLimitResult> {
  const restTier = await fetchSubscriptionTierRest(userId);
  let tier = normalizeTier(restTier || 'free');
  if (clientTier) {
    const ct = normalizeTier(clientTier);
    if (TIER_RANK[ct] > TIER_RANK[tier]) {
      console.log(`[runLimitCheckWithRestFallback] client_tier "${ct}" > server "${tier}", using client`);
      tier = ct;
    }
  }
  const limit = getItemLimit(tier);
  if (limit === null) {
    return { allowed: true, limit: null, current: 0 };
  }
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim().replace(/\/$/, '');
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!base || !key) {
    // Paid tier already returned above; here limit is finite — don't allow adds without a way to count
    return { allowed: false, limit, current: limit };
  }
  try {
    const res = await fetch(
      `${base}/rest/v1/items?user_id=eq.${encodeURIComponent(userId)}&status=eq.active&select=id`,
      {
        headers: {
          apikey: key,
          Authorization: `Bearer ${key}`,
          Accept: 'application/json',
          Prefer: 'count=exact',
        },
        cache: 'no-store',
      }
    );
    const range = res.headers.get('content-range');
    const total = range?.split('/')[1];
    const count = total && total !== '*' ? parseInt(total, 10) : 0;
    const n = Number.isFinite(count) ? count : 0;
    return { allowed: n < limit, limit, current: n };
  } catch {
    return { allowed: false, limit, current: limit };
  }
}

async function runLimitCheck(client: any, userId: string, fallbackSupabase?: any, clientTier?: string): Promise<ItemLimitResult> {
  if (!client) {
    return runLimitCheckWithRestFallback(userId, clientTier);
  }

  const { data: profile, error: profileError } = await client
    .from('profiles')
    .select('subscription_tier, stripe_subscription_id')
    .eq('id', userId)
    .maybeSingle();

  if (profileError) {
    console.warn('[checkItemLimit] profile read:', profileError.message);
  }

  let raw = profile?.subscription_tier;

  // Paid user but DB still says "free" (webhook lag, env mismatch) while Stripe sub exists — sync once before enforcing cap.
  const stripeSubRaw = (profile as { stripe_subscription_id?: string | null } | null)?.stripe_subscription_id;
  const stripeSub = typeof stripeSubRaw === 'string' ? stripeSubRaw.trim() : '';
  if (normalizeTier(raw == null || raw === '' ? '' : String(raw)) === 'free' && stripeSub.startsWith('sub_')) {
    const synced = await tryResyncTierFromStripe(userId);
    if (synced) {
      const { data: p2 } = await client.from('profiles').select('subscription_tier').eq('id', userId).maybeSingle();
      if (p2?.subscription_tier != null && String(p2.subscription_tier).trim() !== '') {
        raw = p2.subscription_tier;
      }
    }
  }

  // JWT client sometimes sees tier when service role row shape differs; take higher tier
  if (fallbackSupabase && fallbackSupabase !== client) {
    const { data: jwtProfile } = await fallbackSupabase
      .from('profiles')
      .select('subscription_tier')
      .eq('id', userId)
      .maybeSingle();
    const j = jwtProfile?.subscription_tier;
    if (j != null && j !== '') {
      const tClient = normalizeTier(raw == null || raw === '' ? '' : String(raw));
      const tJwt = normalizeTier(String(j));
      if (TIER_RANK[tJwt] > TIER_RANK[tClient]) {
        raw = j;
      }
    }
  }

  // PostgREST tier — same DB, fewer client layers; take max(client, REST) so manual Pro/Creator in Supabase always wins
  const restTier = await fetchSubscriptionTierRest(userId);
  if (restTier) {
    const tRest = normalizeTier(restTier);
    const tRaw = normalizeTier(raw == null || raw === '' ? '' : String(raw));
    if (TIER_RANK[tRest] > TIER_RANK[tRaw]) {
      raw = restTier;
    }
  }

  // Client-asserted tier — trust the higher value so misconfigured server env never downgrades a paid user
  if (clientTier) {
    const ct = normalizeTier(clientTier);
    const tRaw = normalizeTier(raw == null || raw === '' ? '' : String(raw));
    if (TIER_RANK[ct] > TIER_RANK[tRaw]) {
      console.log(`[runLimitCheck] client_tier "${ct}" > all server sources "${tRaw}", using client`);
      raw = clientTier;
    }
  }

  const rawStr =
    raw == null || raw === ''
      ? ''
      : typeof raw === 'string'
        ? raw
        : String(raw);
  const tier = normalizeTier(rawStr || 'free');

  console.log(
    `[checkItemLimit] userId=${userId} resolved_tier="${tier}" raw="${rawStr}" clientTier="${clientTier ?? 'none'}" restTier="${restTier ?? 'null'}"`
  );

  if (
    typeof raw === 'string' &&
    raw.trim() !== '' &&
    tier === 'free' &&
    raw.trim().toLowerCase() !== 'free'
  ) {
    console.warn(
      '[checkItemLimit] Unknown subscription_tier value, treating as free:',
      JSON.stringify(raw)
    );
  }

  const limit = getItemLimit(tier);

  if (limit === null) {
    return { allowed: true, limit: null, current: 0 };
  }

  const { count, error: countError } = await client
    .from('items')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('status', 'active');

  if (countError) {
    console.warn('[checkItemLimit] items count:', countError.message);
  }

  return {
    allowed: (count || 0) < limit,
    limit,
    current: count || 0,
  };
}

export async function checkItemLimit(
  supabase: any,
  userId: string,
  clientTier?: string
): Promise<ItemLimitResult> {
  const client = getClientForTierChecks(supabase);
  return runLimitCheck(client, userId, supabase, clientTier);
}

export function isTierAtLeast(
  userTier: string | null | undefined,
  requiredTier: SubscriptionTier
): boolean {
  const order: SubscriptionTier[] = ['free', 'pro', 'creator', 'enterprise'];
  const normalized = normalizeTier(userTier || 'free');
  const userIdx = order.indexOf(normalized);
  const requiredIdx = order.indexOf(requiredTier);
  return userIdx >= requiredIdx;
}

/** Map legacy tier values (e.g. pro_plus) to the new 4-tier system. Case-insensitive. */
export function normalizeTier(tier: string | null | undefined): SubscriptionTier {
  if (tier == null || typeof tier !== 'string') return 'free';
  const t = tier.trim().toLowerCase();
  if (t === '' || t === 'free') return 'free';
  if (t === 'pro_plus' || t === 'pro plus') return 'pro';
  if (t === 'wist_creator' || t === 'creator_tier' || t === 'creator plan') return 'creator';
  const valid: SubscriptionTier[] = ['free', 'pro', 'creator', 'enterprise'];
  return valid.includes(t as SubscriptionTier) ? (t as SubscriptionTier) : 'free';
}
