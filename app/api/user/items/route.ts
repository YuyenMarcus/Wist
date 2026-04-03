export const dynamic = 'force-dynamic';

import { createServerClient } from '@supabase/ssr';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getSupabaseAdmin } from '@/lib/supabase/client';
import { assembleUserProductsFromRaw } from '@/lib/supabase/products';

/**
 * Returns the signed-in user's items + products merged like getUserProducts.
 * Uses service role after cookie auth so broken RLS on `items` cannot hide the owner's rows.
 */
export async function GET() {
  try {
    const cookieStore = await cookies();
    const auth = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll: () => cookieStore.getAll(),
          setAll: (toSet) => {
            toSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
          },
        },
      }
    );

    const {
      data: { user },
      error: authError,
    } = await auth.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const admin = getSupabaseAdmin();
    const ITEMS_LIMIT = 100;

    const [itemsResult, productsResult] = await Promise.all([
      admin
        .from('items')
        .select(
          `
        id,
        user_id,
        title,
        current_price,
        image_url,
        url,
        note,
        status,
        retailer,
        collection_id,
        created_at,
        last_price_check,
        price_check_failures,
        original_currency,
        out_of_stock
      `
        )
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(150),
      admin
        .from('products')
        .select(
          `
        id,
        user_id,
        title,
        price,
        image,
        url,
        description,
        created_at
      `
        )
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(ITEMS_LIMIT),
    ]);

    if (itemsResult.error) {
      console.error('[api/user/items] items:', itemsResult.error);
    }
    if (productsResult.error) {
      console.error('[api/user/items] products:', productsResult.error);
    }

    const allItemRows = itemsResult.data || [];
    const mainItemRows = allItemRows.filter(
      (item: { status?: string | null }) =>
        item.status !== 'queued' && item.status !== 'hidden' && item.status !== 'purchased'
    );
    const itemIds = mainItemRows.map((item: { id: string }) => item.id);

    let priceHistoryRows: any[] | null = null;
    if (itemIds.length > 0) {
      const { data: ph, error: phErr } = await admin
        .from('price_history')
        .select('*')
        .in('item_id', itemIds);
      if (phErr && process.env.NODE_ENV === 'development') {
        console.warn('[api/user/items] price_history:', phErr.message);
      }
      priceHistoryRows = ph ?? null;
    }

    const { data, queued } = assembleUserProductsFromRaw(
      itemsResult.data,
      productsResult.data,
      priceHistoryRows
    );

    const err = itemsResult.error || productsResult.error;
    return NextResponse.json({
      data,
      queued,
      error: err ? { message: err.message, code: (err as { code?: string }).code } : null,
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
