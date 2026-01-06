# 🚂 Railway Service Deployment Guide

## Current Status
- ✅ Project: `wist-scraper` (correct)
- ❌ Service: None (needs to be selected/created)

## Option 1: Deploy via Railway Dashboard (Easiest)

1. Go to: https://railway.app/dashboard
2. Select **wist-scraper** project
3. You should see your services listed
4. Click on the service you want to deploy (or create a new one)
5. Go to **Settings** → **Source**
6. Set **Root Directory** to: `scraper-service`
7. Click **Redeploy**

## Option 2: Use Railway CLI with Service Name

If you know the service name, deploy with:

```powershell
cd scraper-service
railway up --service <service-name>
```

To find service names:
```powershell
railway service
```

## Option 3: Create/Select Service via CLI

```powershell
cd scraper-service

# List available services
railway service

# Or create a new service (if needed)
railway service create scraper

# Then deploy
railway up
```

## ⚠️ Important

Make sure:
- ✅ You're in the `scraper-service` directory
- ✅ `railway.toml` exists (it does ✅)
- ✅ `requirements.txt` exists (it does ✅)
- ✅ `runtime.txt` exists (it does ✅)
- ✅ No `Dockerfile` (deleted ✅)

The `railway.toml` will tell Railway to:
- Use NIXPACKS builder
- Install Python dependencies
- Start with gunicorn

