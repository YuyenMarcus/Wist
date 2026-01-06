# 🚀 Execute Deployment - Step by Step

Follow these steps **in order** to deploy price tracking.

---

## ✅ Step 1: Database Migration (2 minutes)

### 1.1 Open Supabase SQL Editor
1. Go to: https://app.supabase.com
2. Select your project
3. Click **SQL Editor** in the left sidebar
4. Click **New Query**

### 1.2 Run Migration
Copy and paste this SQL:

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

### 1.3 Click "Run" (or press Ctrl+Enter)

**Expected result:** "Success. No rows returned"

### 1.4 Verify Migration
Run this verification query:

```sql
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'items' 
AND column_name IN ('last_price_check', 'price_check_failures');
```

**Should return 2 rows.**

---

## ✅ Step 2: Generate CRON_SECRET (30 seconds)

**Your generated CRON_SECRET:**
```
52610854dc77aba497e58581e99edde8f5a42d051bee0ce31eea976c73b472f3
```

**⚠️ SAVE THIS SECRET** - You'll need it in Step 4!

---

## ✅ Step 3: Deploy Scraper to Railway (10 minutes)

### 3.1 Install Railway CLI (if not installed)
```bash
npm install -g @railway/cli
```

### 3.2 Navigate to Scraper Directory
```bash
cd scraper-service
```

### 3.3 Login to Railway
```bash
railway login
```
- This opens your browser
- Log in with GitHub
- Return to terminal when done

### 3.4 Initialize Project
```bash
railway init
```
- Choose: **"Create new project"**
- Name it: **"wist-scraper"**

### 3.5 Deploy
```bash
railway up
```
- Wait for deployment (~2-3 minutes)
- Watch for "Deployment successful" message

### 3.6 Get Your URL
```bash
railway domain
```
**Copy this URL** - It will look like:
```
wist-scraper-production.up.railway.app
```

### 3.7 Test Deployment
```bash
curl https://your-scraper-url.railway.app/health
```

**Expected response:**
```json
{"status": "ok", "service": "wist-scraper-service", ...}
```

**If you get an error:**
- Check Railway dashboard: https://railway.app/dashboard
- View logs: `railway logs`
- Verify deployment status: `railway status`

---

## ✅ Step 4: Update Environment Variables (5 minutes)

### 4.1 Update Local .env.local

Open `.env.local` in your project root and add:

```bash
# Scraper Service URL (from Railway Step 3.6)
SCRAPER_SERVICE_URL=https://your-scraper-url.railway.app

# Cron Secret (from Step 2)
CRON_SECRET=52610854dc77aba497e58581e99edde8f5a42d051bee0ce31eea976c73b472f3
```

**Replace `your-scraper-url.railway.app` with your actual Railway URL!**

### 4.2 Update Vercel Environment Variables

1. Go to: https://vercel.com/dashboard
2. Select your **wist** project
3. Click **Settings** → **Environment Variables**
4. Click **Add New**
5. Add these variables:

   **Variable 1:**
   - Key: `SCRAPER_SERVICE_URL`
   - Value: `https://your-scraper-url.railway.app` (your Railway URL)
   - Environments: ✅ Production, ✅ Preview, ✅ Development

   **Variable 2:**
   - Key: `CRON_SECRET`
   - Value: `52610854dc77aba497e58581e99edde8f5a42d051bee0ce31eea976c73b472f3`
   - Environments: ✅ Production, ✅ Preview, ✅ Development

6. Click **Save** for each variable

**⚠️ Important:** Make sure to check all three environments (Production, Preview, Development)!

---

## ✅ Step 5: Verify vercel.json (1 minute)

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

**✅ Already created!** This file is already in your repo.

---

## ✅ Step 6: Deploy to Vercel (5 minutes)

### Option A: Auto-Deploy (if enabled)
Just push to main branch:
```bash
git push origin main
```
Vercel will automatically deploy.

### Option B: Manual Deploy
```bash
vercel --prod
```

### 6.1 Verify Deployment
1. Go to: https://vercel.com/dashboard
2. Select your project
3. Check **Deployments** tab
4. Verify latest deployment is successful

---

## ✅ Step 7: Verify Cron Configuration (2 minutes)

1. Go to: https://vercel.com/dashboard
2. Select your project
3. Go to **Settings** → **Crons**
4. You should see:
   - **Path:** `/api/cron/check-prices`
   - **Schedule:** `0 */6 * * *` (every 6 hours)

**If you don't see it:**
- Wait 2-3 minutes after deployment
- Refresh the page
- Check that `vercel.json` is in the root directory

---

## ✅ Step 8: Test Everything (10 minutes)

### 8.1 Test Scraper Service
```bash
curl https://your-scraper-url.railway.app/health
```
Should return: `{"status": "ok", ...}`

### 8.2 Test Cron Endpoint Manually
```bash
curl https://your-app.vercel.app/api/cron/check-prices \
  -H "Authorization: Bearer 52610854dc77aba497e58581e99edde8f5a42d051bee0ce31eea976c73b472f3"
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

**If you get 401 Unauthorized:**
- Verify `CRON_SECRET` matches in Vercel environment variables
- Make sure you included the `Bearer ` prefix in the header

### 8.3 Test Manual Price Check
1. Go to: `https://your-app.vercel.app/dashboard`
2. Click on any item
3. Click **"Check Price Now"** button
4. Verify it works and updates the price

### 8.4 Verify Database
1. Go to: https://app.supabase.com
2. **Table Editor** → `items` table
3. Verify columns exist: `last_price_check`, `price_check_failures`
4. **Table Editor** → `price_history` table
5. Check for new entries after running manual check

---

## 🎉 Success Checklist

After completing all steps, verify:

- [ ] Database migration completed successfully
- [ ] Railway scraper is deployed and responding
- [ ] Environment variables added to `.env.local`
- [ ] Environment variables added to Vercel
- [ ] Vercel deployment successful
- [ ] Cron job appears in Vercel dashboard
- [ ] Manual cron test returns success
- [ ] Manual price check button works
- [ ] Database has new columns
- [ ] Price history table has entries

---

## 📊 What Happens Next?

1. **First automatic cron run:** Within 6 hours of deployment
2. **Price history builds:** Each cron run adds new entries
3. **Charts populate:** After 2+ price checks, charts will show data
4. **Automatic tracking:** System will check prices every 6 hours

---

## 🐛 Troubleshooting

### Railway deployment fails?
```bash
railway logs  # Check logs
railway status  # Check status
```

### Vercel cron not showing?
- Wait 2-3 minutes after deployment
- Verify `vercel.json` is in root directory
- Check deployment logs for errors

### Cron returns 401?
- Verify `CRON_SECRET` matches exactly in Vercel
- Check that you're using `Bearer ` prefix in header
- Redeploy after adding environment variables

### No price history?
- Wait for cron to run (or trigger manually)
- Check Supabase `price_history` table
- Verify items have `url` field populated
- Check cron logs: `vercel logs | grep check-prices`

---

## 📝 Quick Reference

**Your CRON_SECRET:**
```
52610854dc77aba497e58581e99edde8f5a42d051bee0ce31eea976c73b472f3
```

**Test Cron Command:**
```bash
curl https://your-app.vercel.app/api/cron/check-prices \
  -H "Authorization: Bearer 52610854dc77aba497e58581e99edde8f5a42d051bee0ce31eea976c73b472f3"
```

**Monitor Logs:**
```bash
# Vercel logs
vercel logs --follow

# Railway logs
railway logs
```

---

**Ready to execute?** Start with Step 1 and work through each step!

