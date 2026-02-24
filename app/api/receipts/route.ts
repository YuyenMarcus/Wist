export const dynamic = 'force-dynamic';

import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { isTierAtLeast } from '@/lib/tier-guards';

const REQUIRED_TIER = 'pro_plus' as const;

async function getAuthenticatedUser(request: Request) {
  const cookieStore = await cookies();
  const supabase = createServerClient(
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

  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return { user: null, supabase };

  const { data: profile } = await supabase
    .from('profiles')
    .select('subscription_tier')
    .eq('id', user.id)
    .single();

  return { user, supabase, tier: profile?.subscription_tier || 'free' };
}

export async function GET(request: Request) {
  try {
    const { user, supabase, tier } = await getAuthenticatedUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!isTierAtLeast(tier, REQUIRED_TIER)) {
      return NextResponse.json({ error: 'Upgrade to Wist Pro to use receipts', upgrade: true, requiredTier: REQUIRED_TIER }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const itemId = searchParams.get('item_id');

    let query = supabase
      .from('receipts')
      .select('*, items(title, image_url, url)')
      .eq('user_id', user.id)
      .order('warranty_expiry', { ascending: true, nullsFirst: false });

    if (itemId) {
      query = query.eq('item_id', itemId);
    }

    const { data, error } = await query;
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ receipts: data || [] });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { user, supabase, tier } = await getAuthenticatedUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!isTierAtLeast(tier, REQUIRED_TIER)) {
      return NextResponse.json({ error: 'Upgrade to Wist Pro to use receipts', upgrade: true }, { status: 403 });
    }

    const body = await request.json();
    const { item_id, title, purchase_date, warranty_expiry, receipt_url, notes } = body;

    if (!title) {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('receipts')
      .insert({
        user_id: user.id,
        item_id: item_id || null,
        title,
        purchase_date: purchase_date || null,
        warranty_expiry: warranty_expiry || null,
        receipt_url: receipt_url || null,
        notes: notes || null,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ receipt: data });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { user, supabase, tier } = await getAuthenticatedUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!isTierAtLeast(tier, REQUIRED_TIER)) {
      return NextResponse.json({ error: 'Upgrade required' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json({ error: 'Receipt ID is required' }, { status: 400 });
    }

    const { error } = await supabase
      .from('receipts')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
