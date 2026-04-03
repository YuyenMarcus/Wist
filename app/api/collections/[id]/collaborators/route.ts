export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { authenticateRequest, getCollectionRole } from '@/lib/collections/auth';
import { getServiceRoleSupabase } from '@/lib/supabase/service-role';

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const auth = await authenticateRequest(request);
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const collectionId = params.id;
  const { role, ownerId } = await getCollectionRole(collectionId, auth.userId);

  if (!role) {
    return NextResponse.json({ error: 'Not a member of this collection' }, { status: 403 });
  }

  const admin = getServiceRoleSupabase();

  const { data: collabs, error } = await admin
    .from('collection_collaborators')
    .select('user_id, role, joined_at')
    .eq('collection_id', collectionId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const userIds = (collabs || []).map(c => c.user_id);
  if (ownerId && !userIds.includes(ownerId)) {
    userIds.push(ownerId);
  }

  const { data: profiles } = await admin
    .from('profiles')
    .select('id, full_name, avatar_url, username')
    .in('id', userIds);

  const profileMap = new Map((profiles || []).map(p => [p.id, p]));

  const collaborators = (collabs || []).map(c => ({
    userId: c.user_id,
    role: c.role,
    joinedAt: c.joined_at,
    ...(profileMap.get(c.user_id) || {}),
  }));

  const ownerProfile = ownerId ? profileMap.get(ownerId) : null;

  return NextResponse.json({
    owner: ownerProfile ? { userId: ownerId, role: 'owner', ...ownerProfile } : null,
    collaborators,
  });
}
