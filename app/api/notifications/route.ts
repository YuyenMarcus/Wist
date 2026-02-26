export const dynamic = 'force-dynamic';

import { createServerClient } from '@supabase/ssr';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { isTierAtLeast } from '@/lib/tier-guards';

async function getSupabaseClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        },
      },
    }
  );
}

/**
 * GET /api/notifications
 * Fetch user's notifications (tier-gated)
 */
export async function GET(request: Request) {
  try {
    const supabase = await getSupabaseClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('subscription_tier')
      .eq('id', user.id)
      .single();

    const tier = profile?.subscription_tier || 'free';

    // Fetch last 50 notifications, newest first
    const { data: notifications, error } = await supabase
      .from('notification_queue')
      .select(`
        id,
        item_id,
        notification_type,
        old_price,
        new_price,
        price_change_percent,
        sent,
        is_read,
        created_at,
        items (
          title,
          image_url,
          url,
          retailer
        )
      `)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      console.error('Failed to fetch notifications:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Filter notification types by tier:
    // - Free: price_drop only
    // - Pro+: price_drop + back_in_stock + price_increase
    const filtered = (notifications || []).filter(n => {
      if (n.notification_type === 'price_drop') return true;
      if (n.notification_type === 'back_in_stock') return isTierAtLeast(tier, 'pro');
      if (n.notification_type === 'price_increase') return isTierAtLeast(tier, 'pro');
      return false;
    });

    // Count unread
    const unreadCount = filtered.filter(n => !(n as any).is_read).length;

    // Map is_read -> read for the frontend
    const mapped = filtered.map(n => ({
      ...n,
      read: (n as any).is_read ?? false,
    }));

    return NextResponse.json({
      notifications: mapped,
      unreadCount,
      tier,
    });
  } catch (err: any) {
    console.error('Notification API error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

/**
 * PATCH /api/notifications
 * Mark notifications as read
 * Body: { ids: string[] } or { markAllRead: true }
 */
export async function PATCH(request: Request) {
  try {
    const supabase = await getSupabaseClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();

    if (body.markAllRead) {
      const { error } = await supabase
        .from('notification_queue')
        .update({ is_read: true })
        .eq('user_id', user.id)
        .eq('is_read', false);

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({ success: true });
    }

    if (body.ids && Array.isArray(body.ids)) {
      const { error } = await supabase
        .from('notification_queue')
        .update({ is_read: true })
        .in('id', body.ids)
        .eq('user_id', user.id);

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  } catch (err: any) {
    console.error('Notification PATCH error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
