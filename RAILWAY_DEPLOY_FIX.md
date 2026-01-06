# 🚂 Railway Deployment Fix

## ✅ What I've Done

1. **Created `railway.json`** - Tells Railway this is a Python app using NIXPACKS
2. **Created `nixpacks.toml`** - Explicit Python 3.11 configuration
3. **Committed and pushed** - Changes are in GitHub

## 🚀 Next Steps: Deploy to Railway

### Option 1: Deploy from scraper-service directory (Recommended)

```powershell
# Navigate to scraper-service
cd scraper-service

# Make sure you're logged in
railway login

# Deploy (Railway will detect Python from railway.json and nixpacks.toml)
railway up
```

### Option 2: If Railway still detects wrong directory

If Railway is still trying to build Next.js, you may need to:

1. **Link the service explicitly:**
```powershell
cd scraper-service
railway link
# Select your "wist-scraper" project
```

2. **Or create a new service:**
```powershell
cd scraper-service
railway service
# Create a new service called "scraper"
railway up
```

### Option 3: Use Railway Dashboard

1. Go to: https://railway.app/dashboard
2. Select your **wist-scraper** project
3. Click **"New"** → **"GitHub Repo"**
4. Select your repository
5. **IMPORTANT:** Set the **Root Directory** to `scraper-service`
6. Railway will auto-detect Python from `requirements.txt` and `runtime.txt`

## 🔍 Verify Deployment

After deployment, test:

```powershell
curl https://wist-scraper-production.up.railway.app/health
```

Expected response:
```json
{"status": "ok", "service": "wist-scraper-service", ...}
```

## ⚠️ Troubleshooting

### Railway still building Next.js?
- Make sure you're in the `scraper-service` directory when running `railway up`
- Or set the root directory in Railway dashboard to `scraper-service`

### Build fails?
- Check logs: `railway logs`
- Verify `requirements.txt` has all dependencies
- Make sure `runtime.txt` specifies `python-3.11`

### Service not starting?
- Check that `app.py` exists and has the Flask app
- Verify gunicorn is in `requirements.txt` (it is ✅)
- Check logs for port binding errors

