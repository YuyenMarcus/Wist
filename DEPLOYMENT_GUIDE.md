# 🚀 Price Tracking Deployment Guide

Complete guide to deploying and configuring automated price tracking.

## 📋 Prerequisites

- ✅ Supabase project set up
- ✅ Vercel account (for Next.js deployment)
- ✅ Railway account (for scraper service) - [Sign up free](https://railway.app)
- ✅ Environment variables ready

---

## Step 1: Deploy Scraper Service to Railway (30 min)

### 1.1 Install Railway CLI
```bash
npm install -g @railway/cli
```

### 1.2 Login to Railway
```bash
railway login
```

### 1.3 Navigate to scraper-service folder
```bash
cd scraper-service
```

### 1.4 Initialize Railway project
```bash
railway init
```
- Choose "Create new project"
- Name it: `wist-scraper`

### 1.5 Deploy
```bash
railway up
```

### 1.6 Get your deployed URL
```bash
railway domain
```
**Copy this URL** - you'll need it for environment variables (e.g., `https://wist-scraper.railway.app`)

### 1.7 Verify deployment
```bash
curl https://your-scraper.railway.app/health
```
Should return: `{"status": "ok", ...}`

---

## Step 2: Run Database Migration (5 min)

### 2.1 Open Supabase SQL Editor
1. Go to your Supabase dashboard
2. Navigate to **SQL Editor**
3. Click **New Query**

### 2.2 Run the migration
Copy and paste the contents of `supabase-add-price-tracking-columns.sql`:

```sql
-- Add price tracking columns to items table
ALTER TABLE items 
ADD COLUMN IF NOT EXISTS last_price_check TIMESTAMPTZ DEFAULT NOW();

ALTER TABLE items 
ADD COLUMN IF NOT EXISTS price_check_failures INTEGER DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_items_last_price_check 
ON items(last_price_check) 
WHERE status = 'active';

ALTER TABLE items 
ADD CONSTRAINT chk_failures_positive 
CHECK (price_check_failures >= 0);
```

### 2.3 Click "Run" and verify success
You should see: `Success. No rows returned`

---

## Step 3: Configure Environment Variables (10 min)

### 3.1 Local Environment (.env.local)

Add these to your `.env.local` file in the project root:

```bash
# Existing variables (keep these)
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# NEW: Scraper service URL (from Railway)
SCRAPER_SERVICE_URL=https://your-scraper.railway.app

# NEW: Cron secret (generate with: openssl rand -hex 32)
CRON_SECRET=your-random-secret-here-12345
```

**Generate CRON_SECRET:**
```bash
# On Mac/Linux:
openssl rand -hex 32

# On Windows (PowerShell):
-join ((48..57) + (65..90) + (97..122) | Get-Random -Count 32 | % {[char]$_})
```

### 3.2 Vercel Environment Variables

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Select your project
3. Go to **Settings** → **Environment Variables**
4. Add these variables (same values as `.env.local`):
   - `SCRAPER_SERVICE_URL`
   - `CRON_SECRET`
   - `SUPABASE_SERVICE_ROLE_KEY` (if not already added)

**Important:** Make sure to add them for **Production**, **Preview**, and **Development** environments.

---

## Step 4: Verify vercel.json (2 min)

Check that `vercel.json` exists in your project root:

```json
{
  "crons": [
    {
      "path": "/api/cron/check-prices",
      "schedule": "0 */6 * * *"
    }
  ]
}
```

**Schedule options:**
- `"0 */6 * * *"` - Every 6 hours (recommended)
- `"0 */12 * * *"` - Every 12 hours (more conservative)
- `"0 */4 * * *"` - Every 4 hours (more aggressive)
- `"0 2,14 * * *"` - At 2 AM and 2 PM daily (off-peak)

---

## Step 5: Deploy to Vercel (10 min)

### 5.1 Commit changes
```bash
git add .
git commit -m "Add automated price tracking with cron jobs"
git push origin main
```

### 5.2 Deploy
```bash
vercel --prod
```

Or if you have auto-deploy enabled, Vercel will deploy automatically on push.

---

## Step 6: Test Everything (30 min)

### 6.1 Test Scraper Service
```bash
# Health check
curl https://your-scraper.railway.app/health

# Test scraping
curl -X POST https://your-scraper.railway.app/api/scrape/sync \
  -H "Content-Type: application/json" \
  -d '{"url":"https://www.amazon.com/dp/B08N5WRWNW"}'
```

### 6.2 Test Cron Endpoint Manually
```bash
curl https://your-app.vercel.app/api/cron/check-prices \
  -H "Authorization: Bearer your_cron_secret"
```

**Expected response:**
```json
{
  "success": true,
  "checked": 5,
  "updates": 2,
  "message": "Processed all 5 items."
}
```

### 6.3 Test Manual Price Check
1. Go to any item detail page: `/dashboard/item/[id]`
2. Click "Check Price Now" button
3. Verify price updates and history is logged

### 6.4 Verify Price History
1. Go to Supabase Dashboard → **Table Editor**
2. Open `price_history` table
3. Verify new entries are being created

---

## Step 7: Monitor Cron Jobs

### 7.1 Vercel Dashboard
1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Select your project
3. Go to **Settings** → **Crons**
4. You should see: `/api/cron/check-prices` scheduled for every 6 hours

### 7.2 View Logs
```bash
# Vercel logs
vercel logs --follow

# Railway logs (for scraper)
railway logs
```

### 7.3 Check Cron Execution
- First automatic run: Within 6 hours of deployment
- Manual trigger: Use the curl command above
- Monitor in Vercel dashboard → **Deployments** → **Functions**

---

## 🐛 Troubleshooting

### Issue: Cron not running
**Solution:**
1. Verify `vercel.json` is in project root
2. Check Vercel dashboard → Settings → Crons
3. Ensure `CRON_SECRET` is set in Vercel environment variables
4. Check deployment logs for errors

### Issue: Scraper service returns 404
**Solution:**
1. Verify Railway deployment is live: `railway status`
2. Check Railway logs: `railway logs`
3. Verify `SCRAPER_SERVICE_URL` is correct (include `https://`)
4. Test health endpoint manually

### Issue: No price history showing
**Solution:**
1. Wait for cron to run (or trigger manually)
2. Check Supabase `price_history` table for entries
3. Verify `item_id` matches item `id`
4. Check browser console for errors

### Issue: "Unauthorized" error on cron
**Solution:**
1. Verify `CRON_SECRET` matches in `.env.local` and Vercel
2. For manual testing, include header: `Authorization: Bearer your_secret`
3. Vercel cron jobs automatically add this header

### Issue: Items not being checked
**Solution:**
1. Verify items have `status = 'active'`
2. Check `last_price_check` column exists (run migration)
3. Items need `url` field populated
4. Check cron logs for specific errors

---

## 📊 Monitoring Checklist

After 24 hours, verify:

- [ ] Cron job has run at least once (check Vercel logs)
- [ ] Price history table has new entries
- [ ] Items show updated `last_price_check` timestamps
- [ ] Charts display price data on item detail pages
- [ ] No errors in Vercel function logs
- [ ] Scraper service is responding (Railway logs)

---

## 🎯 Next Steps

1. **Set up price drop alerts** (future enhancement)
2. **Add email notifications** when prices drop
3. **Optimize scraping** for specific retailers
4. **Add retry logic** for failed scrapes
5. **Monitor scraper costs** on Railway

---

## 📝 Quick Reference

### Environment Variables Checklist
```bash
✅ NEXT_PUBLIC_SUPABASE_URL
✅ NEXT_PUBLIC_SUPABASE_ANON_KEY
✅ SUPABASE_SERVICE_ROLE_KEY
✅ SCRAPER_SERVICE_URL (NEW)
✅ CRON_SECRET (NEW)
```

### Important URLs
- **Vercel Dashboard**: https://vercel.com/dashboard
- **Railway Dashboard**: https://railway.app/dashboard
- **Supabase Dashboard**: https://app.supabase.com
- **Cron Monitor**: Vercel → Settings → Crons

### Useful Commands
```bash
# Test scraper locally
cd scraper-service
python app.py

# Test cron locally
curl http://localhost:3000/api/cron/check-prices \
  -H "Authorization: Bearer your_secret"

# View Railway logs
railway logs

# View Vercel logs
vercel logs --follow

# Redeploy scraper
cd scraper-service
railway up

# Redeploy Next.js
vercel --prod
```

---

**Last Updated**: 2024-12-19
**Status**: ✅ Ready for deployment
