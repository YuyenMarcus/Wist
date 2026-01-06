-- 📊 Supabase Monitoring Queries
-- Run these in Supabase SQL Editor to monitor your usage

-- ============================================
-- 1. Check Total Item Counts
-- ============================================

-- Total items per user (identify power users)
SELECT 
  u.email,
  COUNT(i.id) as item_count,
  COUNT(CASE WHEN i.status = 'active' THEN 1 END) as active_items,
  COUNT(CASE WHEN i.status = 'purchased' THEN 1 END) as purchased_items
FROM auth.users u
LEFT JOIN items i ON i.user_id = u.id
GROUP BY u.id, u.email
ORDER BY item_count DESC
LIMIT 10;

-- Total active items (what cron job processes)
SELECT 
  COUNT(*) as total_active_items,
  COUNT(DISTINCT user_id) as users_with_items
FROM items
WHERE url IS NOT NULL 
  AND status = 'active';

-- ============================================
-- 2. Check Price History Size
-- ============================================

-- Price history entries per item
SELECT 
  i.title,
  COUNT(ph.id) as history_entries,
  MIN(ph.created_at) as first_entry,
  MAX(ph.created_at) as last_entry
FROM items i
LEFT JOIN price_history ph ON ph.item_id = i.id
WHERE i.status = 'active'
GROUP BY i.id, i.title
ORDER BY history_entries DESC
LIMIT 20;

-- Total price history entries
SELECT 
  COUNT(*) as total_entries,
  COUNT(DISTINCT item_id) as items_with_history,
  MIN(created_at) as oldest_entry,
  MAX(created_at) as newest_entry
FROM price_history;

-- ============================================
-- 3. Check Database Size
-- ============================================

-- Table sizes
SELECT 
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size,
  pg_total_relation_size(schemaname||'.'||tablename) AS size_bytes
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY size_bytes DESC;

-- Total database size
SELECT pg_size_pretty(pg_database_size(current_database())) as total_size;

-- ============================================
-- 4. Check Recent Activity
-- ============================================

-- Items created in last 7 days
SELECT 
  DATE(created_at) as date,
  COUNT(*) as items_created
FROM items
WHERE created_at > NOW() - INTERVAL '7 days'
GROUP BY DATE(created_at)
ORDER BY date DESC;

-- Price checks in last 24 hours
SELECT 
  DATE_TRUNC('hour', created_at) as hour,
  COUNT(*) as price_checks
FROM price_history
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY DATE_TRUNC('hour', created_at)
ORDER BY hour DESC;

-- ============================================
-- 5. Identify Optimization Opportunities
-- ============================================

-- Users with > 100 items (may need pagination increase)
SELECT 
  u.email,
  COUNT(i.id) as item_count
FROM auth.users u
JOIN items i ON i.user_id = u.id
WHERE i.status = 'active'
GROUP BY u.id, u.email
HAVING COUNT(i.id) > 100
ORDER BY item_count DESC;

-- Items with > 100 price history entries (may need limit increase)
SELECT 
  i.title,
  COUNT(ph.id) as history_count
FROM items i
JOIN price_history ph ON ph.item_id = i.id
GROUP BY i.id, i.title
HAVING COUNT(ph.id) > 100
ORDER BY history_count DESC
LIMIT 10;

-- ============================================
-- 6. Check for Orphaned Data
-- ============================================

-- Price history for deleted items (should be 0 due to CASCADE)
SELECT COUNT(*) as orphaned_price_history
FROM price_history ph
LEFT JOIN items i ON ph.item_id = i.id
WHERE i.id IS NULL;

-- Items without valid URLs
SELECT COUNT(*) as items_without_url
FROM items
WHERE url IS NULL OR url = '';

-- ============================================
-- 7. Storage Bucket Sizes (if using Storage)
-- ============================================

-- Note: Storage bucket sizes are checked in Dashboard → Storage
-- This query won't work in SQL Editor, but you can check:
-- Dashboard → Storage → Click each bucket → See size

-- ============================================
-- 8. Egress Estimation (Approximate)
-- ============================================

-- Estimate data transfer per user query (items table)
SELECT 
  pg_size_pretty(
    AVG(
      pg_column_size(id) +
      pg_column_size(user_id) +
      pg_column_size(title) +
      pg_column_size(url) +
      pg_column_size(current_price) +
      pg_column_size(image_url) +
      pg_column_size(created_at)
    ) * COUNT(*)
  ) as estimated_size_per_user_query
FROM items
WHERE user_id IN (
  SELECT id FROM auth.users LIMIT 1
);

-- Estimate cron job data transfer (all active items)
SELECT 
  pg_size_pretty(
    SUM(
      pg_column_size(id) +
      pg_column_size(url) +
      pg_column_size(current_price) +
      pg_column_size(status) +
      pg_column_size(updated_at)
    )
  ) as estimated_cron_job_size
FROM items
WHERE url IS NOT NULL 
  AND status = 'active';

