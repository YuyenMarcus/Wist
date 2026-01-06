# 🧹 Supabase Storage Cleanup Guide - Get Under 500MB

This guide helps you clean up your Supabase database to stay under the 500MB free tier limit.

## 📋 Quick Start

1. **Run Analysis** → `supabase-cleanup-analysis.sql` in Supabase SQL Editor
2. **Execute Cleanup** → `supabase-cleanup-execute.sql` (start with price_history)
3. **Set Up Auto-Cleanup** → Use the cleanup cron job or SQL functions

---

## Step 1: Find What's Eating Your Storage (5 minutes)

### Run Analysis Queries

Open **Supabase Dashboard → SQL Editor** and run `supabase-cleanup-analysis.sql`

This will show you:
- Table sizes (which tables are huge)
- Row counts (how many records in each table)
- Price history age distribution
- Test data that can be deleted
- Orphaned records
- Base64 images (storage killer!)
- Inactive users

**Most likely culprits:**
1. 🔥 `price_history` with months of old data
2. 🔥 `products` storing base64 images instead of URLs
3. 🔥 Test data you forgot about

---

## Step 2: Execute Cleanup (10 minutes)

### ⚠️ BACKUP FIRST (Recommended)

Before deleting, create backups:

```sql
-- Backup price_history
CREATE TABLE IF NOT EXISTS price_history_backup AS 
SELECT * FROM price_history;
```

### Quick Wins (Do These First)

#### A. Delete Old Price History (BIGGEST WIN - Can free 1-3GB!)

```sql
-- See what you're about to delete
SELECT 
  COUNT(*) as rows_to_delete,
  MIN(created_at) as oldest_date,
  MAX(created_at) as newest_date
FROM price_history
WHERE created_at < NOW() - INTERVAL '90 days';

-- Delete old price history (keeps last 90 days)
DELETE FROM price_history
WHERE created_at < NOW() - INTERVAL '90 days';
```

**This alone could save you 1-3GB!**

#### B. Delete Test Products

```sql
-- Preview first
SELECT id, title, url 
FROM products 
WHERE 
  title ILIKE '%test%' 
  OR url ILIKE '%example.com%'
  OR url ILIKE '%localhost%'
LIMIT 20;

-- Delete them
DELETE FROM products
WHERE 
  title ILIKE '%test%' 
  OR url ILIKE '%example.com%'
  OR url ILIKE '%localhost%';
```

#### C. Delete Base64 Images (CRITICAL!)

If you're storing images as base64, STOP! This can use 500MB-2GB.

```sql
-- Check if you have base64 images
SELECT COUNT(*) 
FROM products 
WHERE image LIKE 'data:image%';

-- Delete products with base64 images (you'll need to re-scrape)
DELETE FROM products 
WHERE image LIKE 'data:image%';
```

**Fix your scraper to store URLs only:**

```typescript
// ❌ BAD - Storing base64
const product = {
  image: 'data:image/jpeg;base64,/9j/4AAQSkZJRg...' // HUGE
}

// ✅ GOOD - Storing URL
const product = {
  image: 'https://amazon.com/images/product.jpg' // tiny
}
```

#### D. Delete Orphaned Records

```sql
-- Delete orphaned items
DELETE FROM items
WHERE product_id NOT IN (SELECT id FROM products);

-- Delete orphaned price_history
DELETE FROM price_history
WHERE item_id NOT IN (SELECT id FROM items);
```

#### E. Clean Expired Cache

```sql
DELETE FROM product_cache 
WHERE expires_at < NOW();
```

---

## Step 3: Set Up Automatic Cleanup

### Option A: Use SQL Functions (Recommended for Supabase)

1. **Create the cleanup functions:**

Run `supabase-cleanup-function.sql` in Supabase SQL Editor.

2. **Test the functions:**

```sql
-- Test individual cleanup
SELECT * FROM cleanup_old_price_history(90);
SELECT * FROM cleanup_expired_cache();
SELECT * FROM cleanup_old_scrape_errors(30);

-- Or run all cleanups at once
SELECT * FROM run_all_cleanups();
```

3. **Schedule with pg_cron (if enabled):**

```sql
-- Enable pg_cron extension first:
-- Go to Supabase Dashboard → Database → Extensions → Enable pg_cron

-- Schedule weekly cleanup (runs every Sunday at 2 AM UTC)
SELECT cron.schedule(
  'cleanup-old-price-history',
  '0 2 * * 0',
  'SELECT cleanup_old_price_history(90);'
);

-- Schedule daily cache cleanup
SELECT cron.schedule(
  'cleanup-expired-cache',
  '0 3 * * *',
  'SELECT cleanup_expired_cache();'
);
```

### Option B: Use Next.js Cron Job (Recommended for Vercel)

1. **The cleanup API route is already created:** `app/api/cron/cleanup/route.ts`

2. **Add CRON_SECRET to your environment variables:**

```bash
# .env.local
CRON_SECRET=your-secret-key-here
```

3. **Configure Vercel Cron:**

Create `vercel.json` in your project root:

```json
{
  "crons": [
    {
      "path": "/api/cron/cleanup",
      "schedule": "0 2 * * 0"
    }
  ]
}
```

4. **Add CRON_SECRET to Vercel:**

- Go to Vercel Dashboard → Your Project → Settings → Environment Variables
- Add `CRON_SECRET` with a secure random string

5. **Set up the cron job:**

Vercel will automatically call `/api/cron/cleanup` every Sunday at 2 AM UTC.

**To test manually:**

```bash
curl -H "Authorization: Bearer your-secret-key-here" \
  https://your-app.vercel.app/api/cron/cleanup
```

---

## Step 4: Verify You're Under 500MB

```sql
-- Check total database size
SELECT pg_size_pretty(pg_database_size(current_database()));
```

If you're still over 500MB:

1. **Be more aggressive with price_history:**
   ```sql
   -- Keep only 30 days instead of 90
   DELETE FROM price_history
   WHERE created_at < NOW() - INTERVAL '30 days';
   ```

2. **Delete more test data**

3. **Remove inactive users more aggressively**

---

## Step 5: Monitor Storage Usage

### Create a Monitoring Query

Save this as a SQL snippet in Supabase:

```sql
-- Storage monitoring dashboard
SELECT 
  'Total Database' as type,
  pg_size_pretty(pg_database_size(current_database())) as size
UNION ALL
SELECT 
  tablename,
  pg_size_pretty(pg_total_relation_size('public.'||tablename))
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY 
  CASE WHEN type = 'Total Database' THEN 0 ELSE 1 END,
  size DESC;
```

Run this weekly to track your usage.

---

## Quick Wins Checklist

Do these in order - each one takes 5 minutes:

- [ ] **Delete price_history older than 90 days** → Save 1-3GB
- [ ] **Delete test products (name contains 'test')** → Save 100-500MB
- [ ] **Delete orphaned items** → Save 50-200MB
- [ ] **Clear expired product_cache** → Save 50-100MB
- [ ] **Delete products with base64 images** → Save 500MB-2GB
- [ ] **Delete users who never logged in** → Save 50-100MB

**Expected result:** Should easily get you under 500MB.

---

## Emergency: If You're Getting Restricted TODAY

Run this immediately to buy yourself time:

```sql
-- Nuclear option: Keep only last 30 days
BEGIN;

-- Backup critical data
CREATE TABLE IF NOT EXISTS price_history_emergency_backup AS 
SELECT * FROM price_history 
WHERE created_at > NOW() - INTERVAL '30 days';

-- Delete old data
DELETE FROM price_history WHERE created_at < NOW() - INTERVAL '30 days';

-- Check size
SELECT pg_size_pretty(pg_database_size(current_database()));

-- If still over 500MB, delete more:
DELETE FROM price_history WHERE created_at < NOW() - INTERVAL '14 days';

COMMIT;
```

This should instantly free up 80-90% of your storage.

---

## After Cleanup: Stay Under 500MB Forever

### Best Practices

1. **Keep only 90 days of price_history** (auto-delete older)
2. **Store image URLs, not images** (never store base64)
3. **Delete test data regularly** (manual cleanup monthly)
4. **Monitor usage weekly** (run the monitoring query)

### Automatic Cleanup Schedule

- **Daily:** Clean expired cache
- **Weekly:** Clean old price history (keep 90 days)
- **Monthly:** Clean old scrape errors (keep 30 days)

**You should easily stay under 200MB with these practices.**

---

## Files Created

1. **`supabase-cleanup-analysis.sql`** - Analysis queries to find storage hogs
2. **`supabase-cleanup-execute.sql`** - Execution scripts to delete old data
3. **`supabase-cleanup-function.sql`** - SQL functions for automatic cleanup
4. **`app/api/cron/cleanup/route.ts`** - Next.js API route for Vercel cron
5. **`SUPABASE_STORAGE_CLEANUP.md`** - This guide

---

## Troubleshooting

### Cleanup function doesn't exist

Run `supabase-cleanup-function.sql` in Supabase SQL Editor first.

### Cron job not running

1. Check Vercel cron configuration in `vercel.json`
2. Verify `CRON_SECRET` is set in environment variables
3. Check Vercel function logs for errors

### Still over 500MB after cleanup

1. Check for base64 images (biggest culprit)
2. Reduce price_history retention to 30 days
3. Delete more test data
4. Check storage buckets (avatars, etc.)

---

## Summary

**Most likely culprits:**
1. 🔥 **price_history** with months of old data → Delete old rows
2. 🔥 **products** storing base64 images → Store URLs only
3. 🔥 **Test data** you forgot about → Clean it up

**Do this first:**
```sql
DELETE FROM price_history WHERE created_at < NOW() - INTERVAL '90 days';
```

**This one query will probably solve your problem.**

Then set up automatic cleanup so it doesn't happen again.

