# ✅ Vercel Environment Variables Setup

## Required Variables

Add these to your Vercel Dashboard:

### 1. Go to Vercel Dashboard
- URL: https://vercel.com/dashboard
- Select your **wist** project

### 2. Navigate to Settings
- Click **Settings** → **Environment Variables**

### 3. Add These Variables

#### Variable 1: SCRAPER_SERVICE_URL
- **Key:** `SCRAPER_SERVICE_URL`
- **Value:** `https://wist-scraper-production.up.railway.app`
- **Environments:** ✅ Production, ✅ Preview, ✅ Development
- Click **Save**

#### Variable 2: CRON_SECRET
- **Key:** `CRON_SECRET`
- **Value:** `52610854dc77aba497e58581e99edde8f5a42d051bee0ce31eea976c73b472f3`
- **Environments:** ✅ Production, ✅ Preview, ✅ Development
- Click **Save**

## ⚠️ Important Notes

1. **Make sure to check all three environments** (Production, Preview, Development) for both variables
2. After adding variables, **redeploy** your project for changes to take effect
3. You can trigger a redeploy by:
   - Pushing a new commit (already done ✅)
   - Or manually clicking "Redeploy" in Vercel dashboard

## Verify Setup

After adding variables and redeploying, test the cron endpoint:

```powershell
curl https://your-app.vercel.app/api/cron/check-prices `
  -H "Authorization: Bearer 52610854dc77aba497e58581e99edde8f5a42d051bee0ce31eea976c73b472f3"
```

Expected response: `{"success": true, ...}`

