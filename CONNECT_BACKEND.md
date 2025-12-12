# 🔗 Connect Vercel Frontend to Backend

## Overview

Your Vercel frontend needs to know where your backend is. If the backend is still on `localhost:5000`, it won't work in production.

---

## Step 1: Deploy Backend (If Not Done Yet)

### Option A: Railway (Recommended)

1. **Go to Railway**: https://railway.app
   - Sign up/login with GitHub

2. **Create New Project**
   - Click **"New Project"**
   - Select **"Deploy from GitHub repo"**
   - Choose your `Wist` repository

3. **Configure Service**
   - Railway auto-detects Python
   - Set **Root Directory**: `scraper-service`
   - Railway will auto-detect `Procfile` (we created this!)

4. **Add Environment Variables**
   - Go to **Variables** tab
   - Add:
     ```
     SUPABASE_URL=https://ulmhmjqjtebaetocuhno.supabase.co
     SUPABASE_KEY=your-service-role-key
     PORT=5000
     ```

5. **Deploy**
   - Railway automatically deploys
   - Wait for deployment to complete
   - Copy the **Public URL** (e.g., `https://wist-scraper-production.up.railway.app`)

### Option B: Render

1. **Go to Render**: https://render.com
   - Sign up/login with GitHub

2. **Create Web Service**
   - Click **"New +"** → **"Web Service"**
   - Connect your `Wist` repository

3. **Configure**
   - **Root Directory**: `scraper-service`
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `python app.py`
   - **Environment**: Python 3

4. **Add Environment Variables**
   ```
   SUPABASE_URL=https://ulmhmjqjtebaetocuhno.supabase.co
   SUPABASE_KEY=your-service-role-key
   ```

5. **Deploy**
   - Click **"Create Web Service"**
   - Wait for deployment
   - Copy the **URL** (e.g., `https://wist-scraper.onrender.com`)

---

## Step 2: Test Backend is Live

Before connecting to Vercel, verify your backend works:

1. **Health Check**: Visit `https://your-backend-url.com/health`
   - Should return: `{"status": "healthy", ...}`

2. **Test Scraping** (Optional):
   ```bash
   curl -X POST https://your-backend-url.com/api/scrape/sync \
     -H "Content-Type: application/json" \
     -d '{"url": "https://www.amazon.com/dp/B08XYZ"}'
   ```

---

## Step 3: Update Vercel Environment Variable

1. **Go to Vercel Dashboard**: https://vercel.com/dashboard

2. **Select Your Project**
   - Click on your `Wist` project

3. **Go to Settings**
   - Click **"Settings"** (top menu)
   - Click **"Environment Variables"** (left sidebar)

4. **Add/Update Variable**
   - **Key**: `NEXT_PUBLIC_SCRAPER_SERVICE_URL`
   - **Value**: `https://your-backend-url.com` (NO trailing slash!)
   - **Environment**: Select all (Production, Preview, Development)
   - Click **"Save"**

   ⚠️ **CRITICAL - Common Mistakes**:
   
   **❌ The "Slash" Trap:**
   - ❌ Bad: `https://my-wist-backend.railway.app/`
   - ✅ Good: `https://my-wist-backend.railway.app` (NO trailing slash!)
   
   **❌ The "HTTPS" Check:**
   - ❌ Bad: `http://my-backend.com` (browsers block this from HTTPS sites)
   - ✅ Good: `https://my-backend.com` (must use HTTPS!)
   
   **Example**: `https://wist-scraper-production.up.railway.app`

---

## Step 4: Redeploy Vercel (CRITICAL!)

Environment variables don't update live sites automatically. You MUST redeploy.

1. **Go to Deployments Tab**
   - Click **"Deployments"** (top menu)

2. **Redeploy Latest**
   - Find the most recent deployment (top of list)
   - Click the **three dots (...)** button
   - Select **"Redeploy"**
   - Optionally: Uncheck **"Use existing Build Cache"** to force fresh build
   - Click **"Redeploy"**

3. **Wait for Build**
   - Watch the build logs
   - Should complete in 1-2 minutes
   - Status will change to **"Ready"**

---

## Step 5: Test Production

1. **Visit Your Vercel URL**
   - Go to: `https://wist-xxx.vercel.app/dashboard`

2. **Test Product Scraping**
   - Paste an Amazon URL
   - Click **"Fetch"**

3. **Check Browser Console** (F12)
   - Should see successful API calls
   - NO "Mixed Content" errors
   - NO "CORS" errors
   - NO "Connection refused" errors

4. **Verify Backend Connection**
   - Open Network tab (F12 → Network)
   - Look for requests to your backend URL
   - Should see `200 OK` responses

---

## 🐛 Troubleshooting

### "Server returned invalid response" Error
**Problem**: Frontend can't reach backend  
**Common Causes**:
1. **Trailing slash**: `https://backend.com/` → Remove the `/`
2. **HTTP instead of HTTPS**: `http://backend.com` → Use `https://`
3. **Backend not deployed**: Still pointing to `localhost:5000` → Deploy backend first
4. **Cold start (Render free tier)**: First request times out → Wait 10s and retry

**Solution**: 
- Verify backend URL in Vercel env vars (no trailing slash, use HTTPS)
- Test backend health endpoint directly in browser
- Check Railway/Render logs for backend errors

### "Mixed Content" Error
**Problem**: Browser blocks HTTP requests from HTTPS site  
**Solution**: Ensure backend URL uses `https://` not `http://`

### "CORS" Error
**Problem**: Backend not allowing requests from Vercel domain  
**Solution**: Check Flask app has `CORS(app)` enabled (already done in your code)

### "Connection Refused"
**Problem**: Backend URL is wrong or backend is down  
**Solution**: 
- Verify backend URL is correct (no trailing slash)
- Test backend health endpoint directly
- Check Railway/Render logs for errors

### Environment Variable Not Working
**Problem**: Variable not applied  
**Solution**:
- Ensure variable name is exactly: `NEXT_PUBLIC_SCRAPER_SERVICE_URL`
- Must start with `NEXT_PUBLIC_` for client-side access
- Redeploy after adding/updating variables

### Backend Returns 500 Error
**Problem**: Backend has errors  
**Solution**:
- Check Railway/Render logs
- Verify environment variables are set correctly
- Test backend health endpoint
- Check Supabase connection

---

## ✅ Success Checklist

- [ ] Backend deployed to Railway/Render
- [ ] Backend health check works: `https://your-backend.com/health`
- [ ] Vercel environment variable set: `NEXT_PUBLIC_SCRAPER_SERVICE_URL`
- [ ] Vercel redeployed after setting variable
- [ ] Production site works: `https://wist-xxx.vercel.app`
- [ ] Product scraping works in production
- [ ] No console errors in browser
- [ ] Network requests show `200 OK`

---

## 🎉 You're Live!

Once all checks pass, your full-stack app is running in production:
- ✅ Frontend: Vercel (automatic deployments)
- ✅ Backend: Railway/Render (24/7 uptime)
- ✅ Database: Supabase (caching enabled)

**Your scraper is now accessible worldwide! 🌍**

