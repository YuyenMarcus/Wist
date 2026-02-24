export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { verifyAdmin, getAdminClient } from '@/lib/admin/auth';

/**
 * GET /api/admin/users?q=search&page=0&limit=20
 * Search and list users.
 */
export async function GET(request: Request) {
  const adminId = await verifyAdmin(request);
  if (!adminId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const query = searchParams.get('q') || '';
  const page = parseInt(searchParams.get('page') || '0');
  const limit = parseInt(searchParams.get('limit') || '20');
  const offset = page * limit;

  const supabase = getAdminClient();

  let dbQuery = supabase
    .from('profiles')
    .select('id, email, full_name, username, avatar_url, subscription_tier, is_admin, is_banned, ban_reason, age, created_at:updated_at', { count: 'exact' })
    .order('updated_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (query) {
    dbQuery = dbQuery.or(`email.ilike.%${query}%,username.ilike.%${query}%,full_name.ilike.%${query}%`);
  }

  const { data, error, count } = await dbQuery;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Get item counts per user
  const userIds = (data || []).map(u => u.id);
  let itemCounts: Record<string, number> = {};

  if (userIds.length > 0) {
    const { data: items } = await supabase
      .from('items')
      .select('user_id')
      .in('user_id', userIds)
      .eq('status', 'active');

    if (items) {
      for (const item of items) {
        itemCounts[item.user_id] = (itemCounts[item.user_id] || 0) + 1;
      }
    }
  }

  const users = (data || []).map(u => ({
    ...u,
    item_count: itemCounts[u.id] || 0,
  }));

  return NextResponse.json({ users, total: count || 0 });
}

/**
 * PATCH /api/admin/users
 * Update a user's subscription, ban status, or admin flag.
 */
export async function PATCH(request: Request) {
  const adminId = await verifyAdmin(request);
  if (!adminId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const body = await request.json();
  const { user_id, subscription_tier, is_banned, ban_reason, is_admin } = body;

  if (!user_id) {
    return NextResponse.json({ error: 'user_id required' }, { status: 400 });
  }

  const supabase = getAdminClient();
  const updateData: any = {};

  if (subscription_tier !== undefined) updateData.subscription_tier = subscription_tier;
  if (is_banned !== undefined) updateData.is_banned = is_banned;
  if (ban_reason !== undefined) updateData.ban_reason = ban_reason;
  if (is_admin !== undefined) updateData.is_admin = is_admin;

  // If banning, also add to banned_emails table
  if (is_banned === true) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('email')
      .eq('id', user_id)
      .single();

    if (profile?.email) {
      await supabase.from('banned_emails').upsert(
        { email: profile.email, reason: ban_reason || 'Banned by admin', banned_by: adminId },
        { onConflict: 'email' }
      );
    }
  }

  // If unbanning, remove from banned_emails
  if (is_banned === false) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('email')
      .eq('id', user_id)
      .single();

    if (profile?.email) {
      await supabase.from('banned_emails').delete().eq('email', profile.email);
    }
  }

  const { data, error } = await supabase
    .from('profiles')
    .update(updateData)
    .eq('id', user_id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, user: data });
}
