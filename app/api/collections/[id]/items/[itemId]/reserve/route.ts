export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getServiceRoleSupabase } from '@/lib/supabase/service-role';
import { generateReserverToken } from '@/lib/collections/auth';

async function unreserveByToken(
  admin: SupabaseClient,
  itemId: string,
  rawToken: string
): Promise<NextResponse> {
  const token = rawToken.trim();
  if (!token) {
    return NextResponse.json({ error: 'Token required to unreserve' }, { status: 400 });
  }

  const { data: reservation } = await admin
    .from('item_reservations')
    .select('id, reserver_token')
    .eq('item_id', itemId)
    .maybeSingle();

  if (!reservation) {
    return NextResponse.json({ error: 'No reservation found for this item' }, { status: 404 });
  }

  const stored = (reservation.reserver_token ?? '').trim();
  if (stored !== token) {
    return NextResponse.json({ error: 'Invalid token' }, { status: 403 });
  }

  const { error } = await admin.from('item_reservations').delete().eq('id', reservation.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

/**
 * POST — Reserve: { name?: string } → { success, token }
 * POST — Unreserve: { unreserveToken: string } → { success: true }
 */
export async function POST(
  request: Request,
  { params }: { params: { id: string; itemId: string } }
) {
  const collectionId = params.id;
  const itemId = params.itemId;

  let body: Record<string, unknown> = {};
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    /* empty body */
  }

  if (typeof body.unreserveToken === 'string' && body.unreserveToken.trim()) {
    const admin = getServiceRoleSupabase();
    return unreserveByToken(admin, itemId, body.unreserveToken);
  }

  const admin = getServiceRoleSupabase();

  const { data: collection } = await admin
    .from('collections')
    .select('id, registry_mode')
    .eq('id', collectionId)
    .maybeSingle();

  if (!collection || !collection.registry_mode) {
    return NextResponse.json({ error: 'Registry mode is not enabled for this collection' }, { status: 400 });
  }

  const { data: item } = await admin
    .from('items')
    .select('id, collection_id')
    .eq('id', itemId)
    .maybeSingle();

  if (!item || item.collection_id !== collectionId) {
    return NextResponse.json({ error: 'Item not found in this collection' }, { status: 404 });
  }

  const { data: existing } = await admin
    .from('item_reservations')
    .select('id')
    .eq('item_id', itemId)
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ error: 'This item is already reserved' }, { status: 409 });
  }

  const name = typeof body.name === 'string' ? body.name.trim() || null : null;

  const token = generateReserverToken();

  const { error } = await admin.from('item_reservations').insert({
    item_id: itemId,
    collection_id: collectionId,
    reserver_name: name,
    reserver_token: token,
  });

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: 'This item is already reserved' }, { status: 409 });
    }
    console.error('[Reserve] Insert error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, token });
}

/**
 * DELETE — Unreserve (query: ?token=...)
 */
export async function DELETE(
  request: Request,
  { params }: { params: { id: string; itemId: string } }
) {
  const itemId = params.itemId;
  const { searchParams } = new URL(request.url);
  const token = searchParams.get('token') ?? '';

  const admin = getServiceRoleSupabase();
  return unreserveByToken(admin, itemId, token);
}
