export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { verifyAdmin, getAdminClient } from '@/lib/admin/auth';

/**
 * GET /api/admin/banned-emails
 */
export async function GET(request: Request) {
  const adminId = await verifyAdmin(request);
  if (!adminId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const supabase = getAdminClient();
  const { data, error } = await supabase
    .from('banned_emails')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ emails: data || [] });
}

/**
 * POST /api/admin/banned-emails — add an email to the ban list
 */
export async function POST(request: Request) {
  const adminId = await verifyAdmin(request);
  if (!adminId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const { email, reason } = await request.json();
  if (!email) {
    return NextResponse.json({ error: 'email required' }, { status: 400 });
  }

  const supabase = getAdminClient();

  const { error } = await supabase.from('banned_emails').upsert(
    { email: email.toLowerCase().trim(), reason: reason || 'Manually banned', banned_by: adminId },
    { onConflict: 'email' }
  );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Also ban the profile if it exists
  await supabase
    .from('profiles')
    .update({ is_banned: true, ban_reason: reason || 'Manually banned' })
    .eq('email', email.toLowerCase().trim());

  return NextResponse.json({ success: true });
}

/**
 * DELETE /api/admin/banned-emails?email=...
 */
export async function DELETE(request: Request) {
  const adminId = await verifyAdmin(request);
  if (!adminId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const email = searchParams.get('email');
  if (!email) {
    return NextResponse.json({ error: 'email required' }, { status: 400 });
  }

  const supabase = getAdminClient();

  await supabase.from('banned_emails').delete().eq('email', email);
  await supabase
    .from('profiles')
    .update({ is_banned: false, ban_reason: null })
    .eq('email', email);

  return NextResponse.json({ success: true });
}
