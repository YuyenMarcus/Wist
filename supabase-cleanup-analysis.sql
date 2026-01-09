-- 🧹 Supabase Storage Cleanup - Analysis Queries
-- Run these in Supabase SQL Editor to see what's eating your storage

-- ============================================
-- STEP 1: Check Table Sizes
-- ============================================

-- Get size of each table
SELECT 
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size,
  pg_total_relation_size(schemaname||'.'||tablename) AS size_bytes
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY size_bytes DESC;

-- ============================================
-- STEP 2: Check Row Counts
-- ============================================

-- Count rows in each table
SELECT 
  'items' as table_name, 
  COUNT(*) as row_count 
FROM items
UNION ALL
SELECT 'products', COUNT(*) FROM products
UNION ALL
SELECT 'price_history', COUNT(*) FROM price_history
UNION ALL
SELECT 'wishlists', COUNT(*) FROM wishlists
UNION ALL
SELECT 'collections', COUNT(*) FROM collections
UNION ALL
SELECT 'profiles', COUNT(*) FROM profiles
UNION ALL
SELECT 'wishlist_items', COUNT(*) FROM wishlist_items
UNION ALL
SELECT 'product_cache', COUNT(*) FROM product_cache
UNION ALL
SELECT 'scrape_errors', COUNT(*) FROM scrape_errors
ORDER BY row_count DESC;

-- ============================================
-- STEP 3: Check Price History Age Distribution
-- ============================================

-- See price_history age distribution
SELECT 
  CASE 
    WHEN created_at > NOW() - INTERVAL '7 days' THEN 'Last 7 days'
    WHEN created_at > NOW() - INTERVAL '30 days' THEN '7-30 days'
    WHEN created_at > NOW() - INTERVAL '90 days' THEN '30-90 days'
    ELSE 'Older than 90 days'
  END as age_range,
  COUNT(*) as count,
  MIN(created_at) as oldest,
  MAX(created_at) as newest
FROM price_history
GROUP BY 
  CASE 
    WHEN created_at > NOW() - INTERVAL '7 days' THEN 'Last 7 days'
    WHEN created_at > NOW() - INTERVAL '30 days' THEN '7-30 days'
    WHEN created_at > NOW() - INTERVAL '90 days' THEN '30-90 days'
    ELSE 'Older than 90 days'
  END
ORDER BY MIN(created_at);

-- ============================================
-- STEP 4: Check for Test Data
-- ============================================

-- Find test products
SELECT id, title, url, created_at
FROM products 
WHERE 
  title ILIKE '%test%' 
  OR url ILIKE '%example.com%'
  OR url ILIKE '%localhost%'
  OR url ILIKE '%127.0.0.1%'
ORDER BY created_at DESC
LIMIT 50;

-- ============================================
-- STEP 5: Check for Orphaned Records
-- ============================================

-- Find orphaned items (no matching product)
SELECT COUNT(*) as orphaned_items_count
FROM items i
LEFT JOIN products p ON i.product_id = p.id
WHERE p.id IS NULL;

-- Find price_history for deleted items
SELECT COUNT(*) as orphaned_price_history_count
FROM price_history ph
LEFT JOIN items i ON ph.item_id = i.id
WHERE i.id IS NULL;

-- ============================================
-- STEP 6: Check for Base64 Images (Storage Killer!)
-- ============================================

-- Check if products table has base64 images
SELECT 
  id,
  title,
  LENGTH(image) as image_length,
  LEFT(image, 50) as image_preview,
  CASE 
    WHEN image LIKE 'data:image%' THEN 'BASE64 (BAD!)'
    WHEN image LIKE 'http%' THEN 'URL (GOOD)'
    ELSE 'Other'
  END as image_type
FROM products
WHERE image IS NOT NULL
ORDER BY image_length DESC
LIMIT 20;

-- Count base64 images
SELECT COUNT(*) as base64_image_count
FROM products 
WHERE image LIKE 'data:image%';

-- ============================================
-- STEP 7: Check Inactive Users
-- ============================================

-- Find users who never logged in after signup
SELECT 
  u.id, 
  u.email, 
  u.created_at,
  u.last_sign_in_at,
  CASE 
    WHEN u.last_sign_in_at IS NULL THEN 'Never logged in'
    WHEN u.last_sign_in_at < NOW() - INTERVAL '30 days' THEN 'Inactive 30+ days'
    ELSE 'Active'
  END as status
FROM auth.users u
WHERE u.last_sign_in_at IS NULL
   OR u.last_sign_in_at < NOW() - INTERVAL '30 days'
ORDER BY u.created_at DESC
LIMIT 20;

-- Count items/profiles for inactive users
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

-- ============================================
-- STEP 8: Total Database Size
-- ============================================

-- Check total database size
SELECT 
  'Total Database' as type,
  pg_size_pretty(pg_database_size(current_database())) as size,
  pg_database_size(current_database()) as size_bytes
UNION ALL
SELECT 
  'All Tables Combined',
  pg_size_pretty(SUM(pg_total_relation_size(schemaname||'.'||tablename))::bigint),
  SUM(pg_total_relation_size(schemaname||'.'||tablename))::bigint
FROM pg_tables
WHERE schemaname = 'public';


