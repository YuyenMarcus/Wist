import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

// Use SERVICE_ROLE_KEY to bypass RLS for cleanup operations
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing Supabase credentials. Check your .env.local file.');
}

const supabase = createClient(supabaseUrl, supabaseKey);

export const dynamic = 'force-dynamic';

/**
 * Automatic cleanup cron job
 * 
 * This endpoint should be called by Vercel Cron or similar service.
 * 
 * To secure it, add a CRON_SECRET environment variable and verify it:
 * 
 * const authHeader = request.headers.get('authorization');
 * if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
 *   return Response.json({ error: 'Unauthorized' }, { status: 401 });
 * }
 */
export async function GET(request: Request) {
  try {
    console.log('\n--- 🧹 STARTING AUTOMATIC CLEANUP ---');
    
    // Optional: Verify this is actually a cron job
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      console.log('❌ Unauthorized: Invalid or missing CRON_SECRET');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const results: Record<string, any> = {};

    // ============================================
    // 1. Tier-Aware Price History Cleanup
    //    free/pro: keep 90 days
    //    pro_plus/creator/enterprise: keep 730 days (2 years)
    // ============================================
    console.log('\n📊 Cleaning old price history (tier-aware retention)...');

    const { count: beforeCount } = await supabase
      .from('price_history')
      .select('*', { count: 'exact', head: true });

    // Find item IDs owned by premium users (pro_plus+) who get 2-year retention
    const { data: premiumItems } = await supabase
      .from('items')
      .select('id, user_id, profiles!inner(subscription_tier)')
      .in('profiles.subscription_tier', ['pro_plus', 'creator', 'enterprise']);

    const premiumItemIds = (premiumItems || []).map((i: any) => i.id);

    let deletedTotal = 0;
    const cutoff90 = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
    const cutoff730 = new Date(Date.now() - 730 * 24 * 60 * 60 * 1000).toISOString();

    // Delete >90-day history for non-premium items
    if (premiumItemIds.length > 0) {
      const { error: stdErr, count: stdCount } = await supabase
        .from('price_history')
        .delete({ count: 'exact' })
        .not('item_id', 'in', `(${premiumItemIds.join(',')})`)
        .lt('created_at', cutoff90);

      if (stdErr) console.error('❌ Standard cleanup error:', stdErr.message);
      deletedTotal += stdCount || 0;

      // Delete >730-day history for premium items
      const { error: premErr, count: premCount } = await supabase
        .from('price_history')
        .delete({ count: 'exact' })
        .in('item_id', premiumItemIds)
        .lt('created_at', cutoff730);

      if (premErr) console.error('❌ Premium cleanup error:', premErr.message);
      deletedTotal += premCount || 0;
    } else {
      // No premium users — simple 90-day cleanup for all
      const { error: deleteError, count: delCount } = await supabase
        .from('price_history')
        .delete({ count: 'exact' })
        .lt('created_at', cutoff90);

      if (deleteError) console.error('❌ Price history cleanup error:', deleteError.message);
      deletedTotal += delCount || 0;
    }

    console.log(`✅ Deleted ${deletedTotal} old price history entries`);
    results.price_history = {
      deleted: deletedTotal,
      premium_items: premiumItemIds.length,
      message: `Deleted ${deletedTotal} rows (90d standard, 730d premium)`
    };

    // ============================================
    // 2. Clean Expired Product Cache
    // ============================================
    console.log('\n🗑️  Cleaning expired product cache...');
    
    const { error: cacheError } = await supabase
      .from('product_cache')
      .delete()
      .lt('expires_at', new Date().toISOString());
    
    if (cacheError) {
      console.error('❌ Cache cleanup error:', cacheError);
      results.product_cache = { error: cacheError.message };
    } else {
      console.log('✅ Cleaned expired cache entries');
      results.product_cache = { success: true };
    }

    // ============================================
    // 3. Clean Old Scrape Errors (Keep 30 days)
    // ============================================
    console.log('\n🧹 Cleaning old scrape errors (keeping last 30 days)...');
    
    const { error: errorsError } = await supabase
      .from('scrape_errors')
      .delete()
      .lt('failed_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());
    
    if (errorsError) {
      console.error('❌ Scrape errors cleanup error:', errorsError);
      results.scrape_errors = { error: errorsError.message };
    } else {
      console.log('✅ Cleaned old scrape errors');
      results.scrape_errors = { success: true };
    }

    // ============================================
    // 4. Get Final Database Size (if function exists)
    // ============================================
    try {
      const { data: sizeData, error: sizeError } = await supabase.rpc('pg_database_size', {
        database_name: 'postgres'
      });
      
      if (!sizeError && sizeData) {
        results.database_size = sizeData;
      }
    } catch (e) {
      // Function might not exist, that's okay
      console.log('⚠️  Could not get database size');
    }

    console.log('\n--- ✅ CLEANUP COMPLETE ---');
    console.log('Results:', JSON.stringify(results, null, 2));

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      results
    });

  } catch (error: any) {
    console.error('❌ CRITICAL CLEANUP ERROR:', error);
    return NextResponse.json(
      { 
        error: error.message,
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}

