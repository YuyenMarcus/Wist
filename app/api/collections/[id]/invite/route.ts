export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { authenticateRequest, getCollectionRole, generateInviteCode } from '@/lib/collections/auth';
import { getServiceRoleSupabase } from '@/lib/supabase/service-role';
import { getCollaboratorLimit, type SubscriptionTier } from '@/lib/constants/subscription-tiers';
import { normalizeTier } from '@/lib/tier-guards';

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const auth = await authenticateRequest(request);
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const collectionId = params.id;
  const { role } = await getCollectionRole(collectionId, auth.userId);

  if (role !== 'owner') {
    return NextResponse.json({ error: 'Only the collection owner can create invites' }, { status: 403 });
  }

  const admin = getServiceRoleSupabase();

  const { data: colFlags } = await admin
    .from('collections')
    .select('collaborative_enabled')
    .eq('id', collectionId)
    .maybeSingle();

  if (!colFlags?.collaborative_enabled) {
    return NextResponse.json(
      { error: 'Turn on "Make collaborative" for this collection before creating invites.' },
      { status: 403 }
    );
  }

  const { data: profile } = await admin
    .from('profiles')
    .select('subscription_tier')
    .eq('id', auth.userId)
    .maybeSingle();

  const tier = normalizeTier(profile?.subscription_tier) as SubscriptionTier;
  const limit = getCollaboratorLimit(tier);

  if (limit !== null) {
    const { count } = await admin
      .from('collection_collaborators')
      .select('*', { count: 'exact', head: true })
      .eq('collection_id', collectionId);

    if ((count || 0) >= limit) {
      return NextResponse.json(
        { error: `Collaborator limit reached (${limit}). Upgrade for more.`, limit },
        { status: 403 }
      );
    }
  }

  let body: any = {};
  try { body = await request.json(); } catch {}
  const maxUses = body.max_uses ?? null;
  const expiresInHours = body.expires_in_hours ?? null;
  const expiresAt = expiresInHours
    ? new Date(Date.now() + expiresInHours * 60 * 60 * 1000).toISOString()
    : null;

  const inviteCode = generateInviteCode();

  const { data: invite, error } = await admin
    .from('collection_invites')
    .insert({
      collection_id: collectionId,
      invite_code: inviteCode,
      created_by: auth.userId,
      max_uses: maxUses,
      expires_at: expiresAt,
    })
    .select()
    .single();

  if (error) {
    console.error('[Invite] Insert error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://wist.app';
  const inviteURL = `${appUrl}/invite/${inviteCode}`;

  return NextResponse.json({ inviteCode, inviteURL, invite });
}
