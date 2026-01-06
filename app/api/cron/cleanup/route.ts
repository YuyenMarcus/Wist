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
    // 1. Clean Old Price History (Keep 90 days)
    // ============================================
    console.log('\n📊 Cleaning old price history (keeping last 90 days)...');
    
    // Get count before deletion
    const { count: beforeCount } = await supabase
      .from('price_history')
      .select('*', { count: 'exact', head: true });
    
    const { error: deleteError } = await supabase
      .from('price_history')
      .delete()
      .lt('created_at', new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString());
    
    if (deleteError) {
      console.error('❌ Price history cleanup error:', deleteError);
      results.price_history = { error: deleteError.message };
    } else {
      const { count: afterCount } = await supabase
        .from('price_history')
        .select('*', { count: 'exact', head: true });
      const deleted = (beforeCount || 0) - (afterCount || 0);
      
      console.log(`✅ Deleted ${deleted} old price history entries`);
      results.price_history = {
        deleted,
        remaining: afterCount || 0,
        message: `Deleted ${deleted} rows older than 90 days`
      };
    }

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

