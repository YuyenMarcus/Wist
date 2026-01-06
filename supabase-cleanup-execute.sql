-- 🧹 Supabase Storage Cleanup - EXECUTION SCRIPTS
-- ⚠️ WARNING: These scripts DELETE data. Run analysis queries first!
-- Run these in Supabase SQL Editor

-- ============================================
-- STEP 1: BACKUP FIRST (Recommended)
-- ============================================

-- Create backup tables (optional but recommended)
CREATE TABLE IF NOT EXISTS price_history_backup AS 
SELECT * FROM price_history;

-- ============================================
-- STEP 2: Delete Old Price History (BIGGEST WIN)
-- ============================================

-- First, see what you're about to delete
SELECT 
  COUNT(*) as rows_to_delete,
  MIN(created_at) as oldest_date,
  MAX(created_at) as newest_date,
  pg_size_pretty(SUM(pg_column_size(price_history.*))::bigint) as estimated_size
FROM price_history
WHERE created_at < NOW() - INTERVAL '90 days';

-- Delete old price history (keeps last 90 days)
-- ⚠️ This is the BIGGEST storage saver - can free 1-3GB!
DELETE FROM price_history
WHERE created_at < NOW() - INTERVAL '90 days';

-- Verify deletion
SELECT COUNT(*) as remaining_rows FROM price_history;

-- ============================================
-- STEP 3: Delete Test Products
-- ============================================

-- Preview what will be deleted
SELECT id, title, url, created_at
FROM products 
WHERE 
  title ILIKE '%test%' 
  OR url ILIKE '%example.com%'
  OR url ILIKE '%localhost%'
  OR url ILIKE '%127.0.0.1%'
LIMIT 20;

-- Delete test products (this will CASCADE to items via foreign key)
DELETE FROM products
WHERE 
  title ILIKE '%test%' 
  OR url ILIKE '%example.com%'
  OR url ILIKE '%localhost%'
  OR url ILIKE '%127.0.0.1%';

-- ============================================
-- STEP 4: Delete Orphaned Records
-- ============================================

-- Delete orphaned items (no matching product)
DELETE FROM items
WHERE product_id NOT IN (SELECT id FROM products);

-- Delete price_history for deleted items (shouldn't happen due to CASCADE, but just in case)
DELETE FROM price_history
WHERE item_id NOT IN (SELECT id FROM items);

-- ============================================
-- STEP 5: Delete Base64 Images (CRITICAL!)
-- ============================================

-- Find products with base64 images
SELECT COUNT(*) as base64_count
FROM products 
WHERE image LIKE 'data:image%';

-- Delete products with base64 images (you'll need to re-scrape these)
-- ⚠️ This can free 500MB-2GB if you've been storing images as base64
DELETE FROM products 
WHERE image LIKE 'data:image%';

-- ============================================
-- STEP 6: Delete Inactive Users' Data
-- ============================================

-- First check what you'd delete (SAFETY CHECK)
SELECT 
  'profiles' as table_name,
  COUNT(*) as count
FROM profiles
WHERE user_id IN (
  SELECT id FROM auth.users 
  WHERE last_sign_in_at IS NULL 
  AND created_at < NOW() - INTERVAL '30 days'
)
UNION ALL
SELECT 'items', COUNT(*)
FROM items
WHERE user_id IN (
  SELECT id FROM auth.users 
  WHERE last_sign_in_at IS NULL 
  AND created_at < NOW() - INTERVAL '30 days'
);

-- If those numbers look safe to delete, run:
DELETE FROM profiles
WHERE user_id IN (
  SELECT id FROM auth.users 
  WHERE last_sign_in_at IS NULL 
  AND created_at < NOW() - INTERVAL '30 days'
);

DELETE FROM items
WHERE user_id IN (
  SELECT id FROM auth.users 
  WHERE last_sign_in_at IS NULL 
  AND created_at < NOW() - INTERVAL '30 days'
);

-- ============================================
-- STEP 7: Clean Expired Cache
-- ============================================

-- Delete expired product_cache entries
DELETE FROM product_cache 
WHERE expires_at < NOW();

-- ============================================
-- STEP 8: Clean Old Scrape Errors (Optional)
-- ============================================

-- Delete scrape errors older than 30 days
DELETE FROM scrape_errors
WHERE failed_at < NOW() - INTERVAL '30 days';

-- ============================================
-- STEP 9: Verify Final Size
-- ============================================

-- Check total database size after cleanup
SELECT 
  'Total Database' as type,
  pg_size_pretty(pg_database_size(current_database())) as size
UNION ALL
SELECT 
  'All Tables Combined',
  pg_size_pretty(SUM(pg_total_relation_size(schemaname||'.'||tablename))::bigint)
FROM pg_tables
WHERE schemaname = 'public';

-- ============================================
-- EMERGENCY: Nuclear Option (Keep Only 30 Days)
-- ============================================

-- If you're STILL over 500MB, be more aggressive:
-- Uncomment the lines below to keep only 30 days of price history

-- BEGIN;
-- CREATE TABLE IF NOT EXISTS price_history_emergency_backup AS 
-- SELECT * FROM price_history 
-- WHERE created_at > NOW() - INTERVAL '30 days';
-- 
-- DELETE FROM price_history WHERE created_at < NOW() - INTERVAL '30 days';
-- 
-- SELECT pg_size_pretty(pg_database_size(current_database()));
-- COMMIT;

