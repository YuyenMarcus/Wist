export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { verifyAdmin, getAdminClient } from '@/lib/admin/auth';

const VALID_TIERS = ['free', 'pro', 'creator'] as const;
type Tier = (typeof VALID_TIERS)[number];

function isValidTier(t: unknown): t is Tier {
  return typeof t === 'string' && VALID_TIERS.includes(t as Tier);
}

/**
 * POST /api/admin/set-tier
 * Body: { tier: "free" | "pro" | "creator", username?: string, userId?: string }
 *
 * Sets subscription_tier on a user profile. Requires admin auth.
 * Clears tier_downgraded_at so there's no leftover grace-period lock.
 */
export async function POST(request: Request) {
  const adminId = await verifyAdmin(request);
  if (!adminId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { tier, username, userId } = body as {
    tier: unknown;
    username?: string;
    userId?: string;
  };

  if (!isValidTier(tier)) {
    return NextResponse.json(
      { error: `Invalid tier. Must be one of: ${VALID_TIERS.join(', ')}` },
      { status: 400 }
    );
  }

  if (!username && !userId) {
    return NextResponse.json(
      { error: 'Provide either username or userId' },
      { status: 400 }
    );
  }

  const supabase = getAdminClient();

  let targetUserId = userId;

  if (!targetUserId && username) {
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('id')
      .eq('username', username)
      .single();

    if (error || !profile) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    targetUserId = profile.id;
  }

  const { error: updateError } = await supabase
    .from('profiles')
    .update({
      subscription_tier: tier,
      tier_downgraded_at: null,
    })
    .eq('id', targetUserId);

  if (updateError) {
    console.error('[Admin SetTier] Update failed:', updateError);
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  console.log(`[Admin SetTier] Admin ${adminId} set tier=${tier} for user ${targetUserId}`);

  return NextResponse.json({ success: true, userId: targetUserId, tier });
}
