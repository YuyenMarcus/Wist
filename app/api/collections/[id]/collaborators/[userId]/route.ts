export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { authenticateRequest, getCollectionRole } from '@/lib/collections/auth';
import { getServiceRoleSupabase } from '@/lib/supabase/service-role';

export async function DELETE(
  request: Request,
  { params }: { params: { id: string; userId: string } }
) {
  const auth = await authenticateRequest(request);
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const collectionId = params.id;
  const targetUserId = params.userId;

  const { role } = await getCollectionRole(collectionId, auth.userId);

  const isSelf = auth.userId === targetUserId;
  const isOwner = role === 'owner';

  if (!isSelf && !isOwner) {
    return NextResponse.json(
      { error: 'Only the owner can remove others. You can leave by removing yourself.' },
      { status: 403 }
    );
  }

  if (isOwner && isSelf) {
    return NextResponse.json(
      { error: 'The owner cannot leave their own collection. Transfer ownership or delete it.' },
      { status: 400 }
    );
  }

  const admin = getServiceRoleSupabase();

  const { error } = await admin
    .from('collection_collaborators')
    .delete()
    .eq('collection_id', collectionId)
    .eq('user_id', targetUserId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
