-- 🧹 Supabase Automatic Cleanup Function
-- Creates a function that can be called manually or scheduled via cron

-- ============================================
-- Cleanup Function for Old Price History
-- ============================================

CREATE OR REPLACE FUNCTION cleanup_old_price_history(days_to_keep integer DEFAULT 90)
RETURNS TABLE(
  deleted_count bigint,
  remaining_count bigint,
  message text
) AS $$
DECLARE
  deleted_rows bigint;
  remaining_rows bigint;
BEGIN
  -- Delete old price history
  DELETE FROM price_history
  WHERE created_at < NOW() - (days_to_keep || ' days')::interval;
  
  GET DIAGNOSTICS deleted_rows = ROW_COUNT;
  
  -- Count remaining rows
  SELECT COUNT(*) INTO remaining_rows FROM price_history;
  
  RETURN QUERY SELECT 
    deleted_rows as deleted_count,
    remaining_rows as remaining_count,
    format('Deleted %s rows older than %s days. %s rows remaining.', 
           deleted_rows, days_to_keep, remaining_rows) as message;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- Cleanup Function for Expired Cache
-- ============================================

CREATE OR REPLACE FUNCTION cleanup_expired_cache()
RETURNS TABLE(
  deleted_count bigint,
  message text
) AS $$
DECLARE
  deleted_rows bigint;
BEGIN
  DELETE FROM product_cache 
  WHERE expires_at < NOW();
  
  GET DIAGNOSTICS deleted_rows = ROW_COUNT;
  
  RETURN QUERY SELECT 
    deleted_rows as deleted_count,
    format('Deleted %s expired cache entries.', deleted_rows) as message;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- Cleanup Function for Old Scrape Errors
-- ============================================

CREATE OR REPLACE FUNCTION cleanup_old_scrape_errors(days_to_keep integer DEFAULT 30)
RETURNS TABLE(
  deleted_count bigint,
  message text
) AS $$
DECLARE
  deleted_rows bigint;
BEGIN
  DELETE FROM scrape_errors
  WHERE failed_at < NOW() - (days_to_keep || ' days')::interval;
  
  GET DIAGNOSTICS deleted_rows = ROW_COUNT;
  
  RETURN QUERY SELECT 
    deleted_rows as deleted_count,
    format('Deleted %s scrape errors older than %s days.', deleted_rows, days_to_keep) as message;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- Master Cleanup Function (Runs All Cleanups)
-- ============================================

CREATE OR REPLACE FUNCTION run_all_cleanups()
RETURNS TABLE(
  cleanup_type text,
  deleted_count bigint,
  message text
) AS $$
DECLARE
  price_history_result RECORD;
  cache_result RECORD;
  errors_result RECORD;
BEGIN
  -- Clean price history (keep 90 days)
  SELECT * INTO price_history_result FROM cleanup_old_price_history(90);
  RETURN QUERY SELECT 
    'price_history'::text,
    price_history_result.deleted_count,
    price_history_result.message;
  
  -- Clean expired cache
  SELECT * INTO cache_result FROM cleanup_expired_cache();
  RETURN QUERY SELECT 
    'product_cache'::text,
    cache_result.deleted_count,
    cache_result.message;
  
  -- Clean old scrape errors (keep 30 days)
  SELECT * INTO errors_result FROM cleanup_old_scrape_errors(30);
  RETURN QUERY SELECT 
    'scrape_errors'::text,
    errors_result.deleted_count,
    errors_result.message;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- Test the Functions
-- ============================================

-- Test individual cleanup functions
-- SELECT * FROM cleanup_old_price_history(90);
-- SELECT * FROM cleanup_expired_cache();
-- SELECT * FROM cleanup_old_scrape_errors(30);

-- Test master cleanup function
-- SELECT * FROM run_all_cleanups();

-- ============================================
-- Schedule with pg_cron (Optional)
-- ============================================

-- Enable pg_cron extension first:
-- Go to Supabase Dashboard → Database → Extensions → Enable pg_cron

-- Schedule weekly cleanup (runs every Sunday at 2 AM UTC)
-- SELECT cron.schedule(
--   'cleanup-old-price-history',
--   '0 2 * * 0',
--   'SELECT cleanup_old_price_history(90);'
-- );

-- Schedule daily cache cleanup (runs every day at 3 AM UTC)
-- SELECT cron.schedule(
--   'cleanup-expired-cache',
--   '0 3 * * *',
--   'SELECT cleanup_expired_cache();'
-- );

-- Check scheduled jobs
-- SELECT * FROM cron.job;

-- Remove a scheduled job
-- SELECT cron.unschedule('cleanup-old-price-history');

