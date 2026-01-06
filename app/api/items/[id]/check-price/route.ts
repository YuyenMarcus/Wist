import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { scrapeProduct } from '@/lib/scraper';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing Supabase credentials');
}

const supabase = createClient(supabaseUrl, supabaseKey);

export const dynamic = 'force-dynamic';

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    // Get current user from request (if available)
    const authHeader = request.headers.get('authorization');
    let user = null;
    
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.replace('Bearer ', '');
      const { data: { user: authUser } } = await supabase.auth.getUser(token);
      user = authUser;
    }

    // Get item
    const { data: item, error: fetchError } = await supabase
      .from('items')
      .select('*')
      .eq('id', params.id)
      .single();

    if (fetchError || !item) {
      return NextResponse.json(
        { error: 'Item not found' },
        { status: 404 }
      );
    }

    // If user is provided, verify ownership (optional check)
    if (user && item.user_id !== user.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 403 }
      );
    }

    console.log(`🔍 Manual price check for item: ${item.title}`);

    // Fetch new price using scraper
    const freshData = await scrapeProduct(item.url);

    if (!freshData || !freshData.current_price) {
      // Update failure count
      await supabase
        .from('items')
        .update({
          last_price_check: new Date().toISOString(),
          price_check_failures: (item.price_check_failures || 0) + 1
        })
        .eq('id', item.id);

      return NextResponse.json(
        { 
          error: 'Failed to fetch price',
          details: 'Scraper returned no price data. The site may be blocking automated access.'
        },
        { status: 500 }
      );
    }

    const newPrice = freshData.current_price;
    const oldPrice = item.current_price || 0;
    const priceChanged = Math.abs(Number(newPrice) - Number(oldPrice)) > 0.01;

    // Update item
    const { error: updateError } = await supabase
      .from('items')
      .update({
        current_price: newPrice,
        last_price_check: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        price_check_failures: 0 // Reset on success
      })
      .eq('id', item.id);

    if (updateError) {
      console.error('Update error:', updateError);
      return NextResponse.json(
        { error: 'Failed to update item', details: updateError.message },
        { status: 500 }
      );
    }

    // Log price history if price changed
    if (priceChanged) {
      await supabase
        .from('price_history')
        .insert({
          item_id: item.id,
          price: newPrice
        });
    }

    return NextResponse.json({
      success: true,
      price: newPrice,
      oldPrice: oldPrice,
      priceChanged,
      message: priceChanged 
        ? `Price updated from $${oldPrice.toFixed(2)} to $${newPrice.toFixed(2)}`
        : `Price unchanged: $${newPrice.toFixed(2)}`
    });

  } catch (error: any) {
    console.error('Manual price check error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to check price',
        details: error.message 
      },
      { status: 500 }
    );
  }
}

