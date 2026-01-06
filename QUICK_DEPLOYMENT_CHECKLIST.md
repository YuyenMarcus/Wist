# ⚡ Quick Deployment Checklist

Execute these steps in order to get price tracking live.

---

## ✅ Step 1: Run Database Migration (5 min)

1. Open [Supabase Dashboard](https://app.supabase.com)
2. Go to **SQL Editor** → **New Query**
3. Copy and paste contents of `supabase-add-price-tracking-columns.sql`
4. Click **Run**
5. Verify: Should see "Success. No rows returned"

---

## ✅ Step 2: Generate CRON_SECRET (1 min)

**On Mac/Linux:**
```bash
openssl rand -hex 32
```

**On Windows (PowerShell):**
```powershell
-join ((48..57) + (65..90) + (97..122) | Get-Random -Count 32 | % {[char]$_})
```

**Save this secret** - you'll need it for Step 4!

---

## ✅ Step 3: Deploy Scraper to Railway (15 min)

```bash
# Install Railway CLI (if not installed)
npm install -g @railway/cli

# Navigate to scraper folder
cd scraper-service

# Login to Railway
railway login

# Create new project
railway init
# Choose: "Create new project"
# Name: wist-scraper

# Deploy
railway up

# Get your URL
railway domain
```

**Copy the Railway URL** (e.g., `https://wist-scraper.railway.app`)

**Verify deployment:**
```bash
curl https://your-scraper.railway.app/health
```

Should return: `{"status": "ok", ...}`

---

## ✅ Step 4: Add Environment Variables (10 min)

### 4.1 Local (.env.local)

Add to your `.env.local` file in project root:

```bash
# Scraper service URL (from Railway)
SCRAPER_SERVICE_URL=https://your-scraper.railway.app

# Cron secret (from Step 2)
CRON_SECRET=your-generated-secret-here
```

### 4.2 Vercel Dashboard

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Select your project
3. Go to **Settings** → **Environment Variables**
4. Add these variables:
   - `SCRAPER_SERVICE_URL` = `https://your-scraper.railway.app`
   - `CRON_SECRET` = `your-generated-secret-here`
5. Make sure to add for **Production**, **Preview**, and **Development**
6. Click **Save**

---

## ✅ Step 5: Deploy to Vercel (5 min)

```bash
# Commit changes
git add .
git commit -m "Configure automated price tracking"
git push origin main

# Deploy to production
vercel --prod
```

Or if auto-deploy is enabled, Vercel will deploy automatically.

---

## ✅ Step 6: Verify Deployment (10 min)

### 6.1 Check Vercel Cron Configuration

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Select your project
3. Go to **Settings** → **Crons**
4. Verify you see: `/api/cron/check-prices`
5. Schedule should be: `0 */6 * * *` (every 6 hours)

### 6.2 Test Cron Endpoint Manually

```bash
# Replace with your values
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

1. Go to your dashboard: `https://your-app.vercel.app/dashboard`
2. Click on any item
3. Click **"Check Price Now"** button
4. Verify it works and updates the price

### 6.4 Verify Database

1. Go to [Supabase Dashboard](https://app.supabase.com)
2. **Table Editor** → `items` table
3. Verify columns: `last_price_check`, `price_check_failures`
4. **Table Editor** → `price_history` table
5. Check for new entries after running manual check

---

## ✅ Step 7: Run Test Script (Optional)

If you're on Mac/Linux:

```bash
chmod +x test-price-tracking.sh
./test-price-tracking.sh
```

Follow the prompts to test all components.

---

## 🎯 What Happens Next?

1. **First automatic cron run**: Within 6 hours of deployment
2. **Price history builds**: Each cron run adds new entries
3. **Charts populate**: After 2+ price checks, charts will show data
4. **Monitoring**: Check logs regularly for the first few days

---

## 📊 Monitoring Commands

```bash
# View Vercel logs
vercel logs --follow

# View Railway logs
railway logs

# Filter for cron jobs
vercel logs | grep check-prices

# Check specific deployment
vercel inspect [deployment-url]
```

---

## 🐛 Troubleshooting

### Cron not running?
- Check Vercel → Settings → Crons
- Verify `vercel.json` is in project root
- Check deployment logs for errors

### Scraper not responding?
- Check Railway dashboard: `railway status`
- View logs: `railway logs`
- Verify `SCRAPER_SERVICE_URL` is correct (include `https://`)

### "Unauthorized" error?
- Verify `CRON_SECRET` matches in `.env.local` and Vercel
- For manual testing, include header: `Authorization: Bearer your_secret`

### No price history?
- Wait for cron to run (or trigger manually)
- Check Supabase `price_history` table
- Verify items have `url` field populated
- Check cron logs for errors

---

## ✅ Final Checklist

- [ ] Database migration run successfully
- [ ] CRON_SECRET generated and saved
- [ ] Scraper deployed to Railway
- [ ] Environment variables added to `.env.local`
- [ ] Environment variables added to Vercel
- [ ] Code deployed to Vercel
- [ ] Vercel cron shows in dashboard
- [ ] Manual cron test works
- [ ] Manual price check works
- [ ] Database has new columns
- [ ] Price history table has entries

---

**🎉 You're all set!** The cron job will run automatically every 6 hours.

