# 🚀 Deploy Now - Quick Steps

Follow these steps **in order**:

---

## Step 1: Deploy Scraper to Railway (10 min)

### Option A: Use PowerShell Script (Easiest)
```powershell
cd scraper-service
.\..\deploy-railway.ps1
```

### Option B: Manual Commands
Open PowerShell and run:

```powershell
cd scraper-service

# Login (opens browser)
railway login

# Initialize project
railway init
# Choose: "Create new project"
# Name: "wist-scraper"

# Deploy
railway up

# Get URL
railway domain
```

**⚠️ Copy the Railway URL** - You'll need it in Step 2!

**Test it:**
```powershell
curl https://your-railway-url.railway.app/health
```

---

## Step 2: Update Environment Variables (5 min)

### Option A: Use PowerShell Script (Easiest)
```powershell
.\update-env-vars.ps1
```
Enter your Railway URL when prompted.

### Option B: Manual Update

**2.1 Update .env.local**

Open `.env.local` in your project root and add:

```bash
SCRAPER_SERVICE_URL=https://your-railway-url.railway.app
CRON_SECRET=52610854dc77aba497e58581e99edde8f5a42d051bee0ce31eea976c73b472f3
```

**2.2 Update Vercel Dashboard**

1. Go to: https://vercel.com/dashboard
2. Select your **wist** project
3. **Settings** → **Environment Variables**
4. Click **Add New** and add:

   **Variable 1:**
   - Key: `SCRAPER_SERVICE_URL`
   - Value: `https://your-railway-url.railway.app`
   - ✅ Production, ✅ Preview, ✅ Development

   **Variable 2:**
   - Key: `CRON_SECRET`
   - Value: `52610854dc77aba497e58581e99edde8f5a42d051bee0ce31eea976c73b472f3`
   - ✅ Production, ✅ Preview, ✅ Development

5. Click **Save**

---

## Step 3: Deploy to Vercel (2 min)

Since you've already pushed to GitHub, Vercel should auto-deploy.

**Or deploy manually:**
```powershell
vercel --prod
```

**Verify deployment:**
1. Go to: https://vercel.com/dashboard
2. Check **Deployments** tab
3. Verify latest deployment is successful

---

## Step 4: Verify Cron Configuration (2 min)

1. Go to: https://vercel.com/dashboard
2. Select your project
3. **Settings** → **Crons**
4. Verify you see: `/api/cron/check-prices`
5. Schedule: `0 */6 * * *` (every 6 hours)

---

## Step 5: Test Everything (5 min)

### Test Scraper:
```powershell
curl https://your-railway-url.railway.app/health
```

### Test Cron:
```powershell
curl https://your-app.vercel.app/api/cron/check-prices `
  -H "Authorization: Bearer 52610854dc77aba497e58581e99edde8f5a42d051bee0ce31eea976c73b472f3"
```

**Expected:** `{"success": true, "checked": X, ...}`

### Test Manual Price Check:
1. Go to: `https://your-app.vercel.app/dashboard`
2. Click any item
3. Click **"Check Price Now"** button
4. Verify it works

---

## ✅ Done!

Your price tracking is now live! The cron will run automatically every 6 hours.

**Monitor:**
- Vercel logs: `vercel logs --follow`
- Railway logs: `railway logs` (from scraper-service folder)

