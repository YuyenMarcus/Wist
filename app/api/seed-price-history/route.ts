import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json({ error: 'Missing credentials' }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get all active items with a price
    const { data: items, error: itemsError } = await supabase
      .from('items')
      .select('id, current_price')
      .eq('status', 'active')
      .not('current_price', 'is', null)
      .gt('current_price', 0);

    if (itemsError) {
      return NextResponse.json({ error: itemsError.message }, { status: 500 });
    }

    if (!items || items.length === 0) {
      return NextResponse.json({ message: 'No items to seed', seeded: 0 });
    }

    // Get item IDs that already have price_history entries
    const { data: existingHistory } = await supabase
      .from('price_history')
      .select('item_id')
      .in('item_id', items.map(i => i.id));

    const itemsWithHistory = new Set((existingHistory || []).map(h => h.item_id));

    // Filter to items that have NO history entries yet
    const itemsToSeed = items.filter(i => !itemsWithHistory.has(i.id));

    if (itemsToSeed.length === 0) {
      return NextResponse.json({ message: 'All items already have history', seeded: 0 });
    }

    // Insert today's price as the first data point for each
    const inserts = itemsToSeed.map(item => ({
      item_id: item.id,
      price: parseFloat(String(item.current_price)),
    }));

    const { error: insertError } = await supabase
      .from('price_history')
      .insert(inserts);

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    return NextResponse.json({
      message: `Seeded price history for ${itemsToSeed.length} items`,
      seeded: itemsToSeed.length,
      alreadyHadHistory: itemsWithHistory.size,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
