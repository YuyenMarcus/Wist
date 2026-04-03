export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/collections/auth';
import { getServiceRoleSupabase } from '@/lib/supabase/service-role';

export async function POST(request: Request) {
  const auth = await authenticateRequest(request);
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: any;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { code } = body;
  if (!code || typeof code !== 'string') {
    return NextResponse.json({ error: 'Invite code required' }, { status: 400 });
  }

  const admin = getServiceRoleSupabase();

  const { data: invite, error: inviteErr } = await admin
    .from('collection_invites')
    .select('id, collection_id, max_uses, use_count, expires_at')
    .eq('invite_code', code.trim())
    .maybeSingle();

  if (inviteErr || !invite) {
    return NextResponse.json({ error: 'Invalid invite code' }, { status: 404 });
  }

  if (invite.expires_at && new Date(invite.expires_at) < new Date()) {
    return NextResponse.json({ error: 'This invite has expired' }, { status: 410 });
  }

  if (invite.max_uses !== null && invite.use_count >= invite.max_uses) {
    return NextResponse.json({ error: 'This invite has been used the maximum number of times' }, { status: 410 });
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

  if (collection.user_id === auth.userId) {
    return NextResponse.json({ error: 'You already own this collection' }, { status: 409 });
  }

  const { data: existing } = await admin
    .from('collection_collaborators')
    .select('id')
    .eq('collection_id', invite.collection_id)
    .eq('user_id', auth.userId)
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ error: 'You are already a collaborator', collectionId: invite.collection_id }, { status: 409 });
  }

  const { error: insertErr } = await admin
    .from('collection_collaborators')
    .insert({
      collection_id: invite.collection_id,
      user_id: auth.userId,
      role: 'editor',
    });

  if (insertErr) {
    console.error('[Join] Insert error:', insertErr);
    return NextResponse.json({ error: insertErr.message }, { status: 500 });
  }

  await admin
    .from('collection_invites')
    .update({ use_count: invite.use_count + 1 })
    .eq('id', invite.id);

  return NextResponse.json({
    success: true,
    collectionId: invite.collection_id,
    collectionName: collection.name,
  });
}
