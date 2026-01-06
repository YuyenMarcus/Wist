r# 🚂 Railway Deployment - Step by Step

You're currently in the `scraper-service` directory. Follow these steps:

---

## Step 1: Login to Railway

**Run this command in your terminal:**
```powershell
railway login
```

**What happens:**
- Opens your browser automatically
- Log in with GitHub
- Return to terminal when done
- You should see: "Logged in as [your-username]"

---

## Step 2: Initialize Railway Project

**Run:**
```powershell
railway init
```

**When prompted:**
- Choose: **"Create new project"**
- Name it: **"wist-scraper"**

This creates a new Railway project and links it to this directory.

---

## Step 3: Deploy

**Run:**
```powershell
railway up
```

**What happens:**
- Railway builds your Docker container
- Deploys the scraper service
- Takes 2-3 minutes
- Watch for "Deployment successful" message

---

## Step 4: Get Your URL

**Run:**
```powershell
railway domain
```

**Copy the output** - It will look like:
```
wist-scraper-production.up.railway.app
```

**⚠️ IMPORTANT:** Save this URL! You'll need it for environment variables.

---

## Step 5: Test Deployment

**Run:**
```powershell
curl https://your-railway-url.railway.app/health
```

**Expected response:**
```json
{"status": "ok", "service": "wist-scraper-service", ...}
```

---

## Step 6: Share Your Railway URL

Once you have the Railway URL, share it with me and I'll help you:
1. Update environment variables
2. Deploy to Vercel
3. Test everything

---

## Troubleshooting

### "Unauthorized" error?
- Run `railway login` again
- Make sure browser login completed

### Deployment fails?
- Check logs: `railway logs`
- Verify Dockerfile exists
- Check requirements.txt is present

### Can't get domain?
- Wait a few minutes after deployment
- Try: `railway domain --generate`

---

**Start with Step 1: `railway login`**

