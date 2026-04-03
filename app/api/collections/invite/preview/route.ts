export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/collections/auth';
import { getServiceRoleSupabase } from '@/lib/supabase/service-role';

/**
 * GET ?code= — Resolve invite for confirmation UI (does not join or increment use_count).
 */
export async function GET(request: Request) {
  const auth = await authenticateRequest(request);
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code')?.trim();
  if (!code) {
    return NextResponse.json({ error: 'Invite code required' }, { status: 400 });
  }

  const admin = getServiceRoleSupabase();

  const { data: invite, error: inviteErr } = await admin
    .from('collection_invites')
    .select('id, collection_id, max_uses, use_count, expires_at')
    .eq('invite_code', code)
    .maybeSingle();

  if (inviteErr || !invite) {
    return NextResponse.json({ error: 'Invalid invite code' }, { status: 404 });
  }

  if (invite.expires_at && new Date(invite.expires_at) < new Date()) {
    return NextResponse.json({ error: 'This invite has expired' }, { status: 410 });
  }

  if (invite.max_uses !== null && invite.use_count >= invite.max_uses) {
    return NextResponse.json(
      { error: 'This invite has been used the maximum number of times' },
      { status: 410 }
    );
  }

  const { data: collection } = await admin
    .from('collections')
    .select('user_id, name, collaborative_enabled')
    .eq('id', invite.collection_id)
    .maybeSingle();

  if (!collection) {
    return NextResponse.json({ error: 'Collection no longer exists' }, { status: 404 });
  }

  if (!collection.collaborative_enabled) {
    return NextResponse.json(
      { error: 'Collaboration is not open for this collection anymore.' },
      { status: 403 }
    );
  }

  const { data: ownerProfile } = await admin
    .from('profiles')
    .select('username, full_name')
    .eq('id', collection.user_id)
    .maybeSingle();

  const ownerUsername = ownerProfile?.username || 'owner';
  const ownerDisplayName =
    (ownerProfile?.full_name && String(ownerProfile.full_name).trim()) || ownerUsername;

  if (collection.user_id === auth.userId) {
    return NextResponse.json({
      canJoin: false,
      reason: 'owner' as const,
      collectionName: collection.name,
      ownerDisplayName,
      ownerUsername,
    });
  }

  const { data: existing } = await admin
    .from('collection_collaborators')
    .select('id')
    .eq('collection_id', invite.collection_id)
    .eq('user_id', auth.userId)
    .maybeSingle();

  if (existing) {
    return NextResponse.json({
      canJoin: false,
      reason: 'already_collaborator' as const,
      collectionName: collection.name,
      ownerDisplayName,
      ownerUsername,
    });
  }

  return NextResponse.json({
    canJoin: true,
    collectionName: collection.name,
    ownerDisplayName,
    ownerUsername,
  });
}
