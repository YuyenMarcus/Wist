# 🚀 Deploy Backend & Connect to Vercel - Step by Step

## 🎯 Goal
Deploy your Python backend to the cloud and connect your Vercel frontend to it.

---

## 📋 Part 1: Deploy Backend to Railway

### Step 1: Create Railway Account

1. **Go to Railway**: https://railway.app
2. **Sign up/Login** with your GitHub account
3. **Complete setup** (if first time)

### Step 2: Create New Project

1. **Click "New Project"** (top right)
2. **Select "Deploy from GitHub repo"**
3. **Authorize Railway** to access your GitHub (if prompted)
4. **Select your `Wist` repository** from the list
5. **Click "Deploy Now"**

### Step 3: Configure Service

Railway will auto-detect it's a Python app. Now configure it:

1. **Click on the service** that was created
2. **Go to "Settings" tab** (left sidebar)
3. **Find "Root Directory"** section
4. **Set Root Directory**: `scraper-service`
   - This tells Railway where your Python code is
5. **Click "Save"**

### Step 4: Add Environment Variables

1. **Go to "Variables" tab** (left sidebar)
2. **Click "New Variable"** for each one:

   **Variable 1:**
   - **Key**: `SUPABASE_URL`
   - **Value**: `https://ulmhmjqjtebaetocuhno.supabase.co`
   - **Click "Add"**

   **Variable 2:**
   - **Key**: `SUPABASE_KEY`
   - **Value**: `your-service-role-key-here` (get from Supabase Dashboard → Settings → API → service_role key)
   - **Click "Add"**

   **Variable 3:**
   - **Key**: `PORT`
   - **Value**: `5000`
   - **Click "Add"**

   ⚠️ **Important**: Replace `your-service-role-key-here` with your actual Supabase service role key!

### Step 5: Wait for Deployment

1. **Go to "Deployments" tab** (left sidebar)
2. **Watch the build logs**
3. **Wait for "Deploy Succeeded"** ✅
   - This usually takes 2-5 minutes
   - Railway will install dependencies and start your Flask app

### Step 6: Get Your Backend URL

1. **Go to "Settings" tab**
2. **Scroll to "Networking" section**
3. **Find "Generate Domain"** button
4. **Click "Generate Domain"**
5. **Copy the URL** (e.g., `https://wist-backend-production.up.railway.app`)
   - ⚠️ **IMPORTANT**: Copy the URL WITHOUT a trailing slash!
   - ✅ Good: `https://wist-backend-production.up.railway.app`
   - ❌ Bad: `https://wist-backend-production.up.railway.app/`

### Step 7: Test Your Backend

1. **Open a new browser tab**
2. **Visit**: `https://your-backend-url.railway.app/health`
   - Replace `your-backend-url.railway.app` with your actual URL
3. **You should see**:
   ```json
   {
     "status": "healthy",
     "service": "wist-scraper",
     "python": true,
     "scrapy": true,
     "crochet": true
   }
   ```

✅ **If you see this, your backend is live!**

---

## 📋 Part 2: Connect Vercel to Your Backend

### Step 1: Go to Vercel Dashboard

1. **Go to**: https://vercel.com/dashboard
2. **Login** if needed
3. **Click on your `Wist` project**

### Step 2: Add Environment Variable

1. **Click "Settings"** (top menu)
2. **Click "Environment Variables"** (left sidebar)
3. **Click "Add New"** button

4. **Fill in the form**:
   - **Key**: `NEXT_PUBLIC_SCRAPER_SERVICE_URL`
     - ⚠️ **Must be EXACTLY this** (case-sensitive!)
   - **Value**: `https://your-backend-url.railway.app`
     - Replace with your actual Railway URL
     - ⚠️ **NO trailing slash!**
   - **Environment**: Select **all three**:
     - ☑️ Production
     - ☑️ Preview
     - ☑️ Development

5. **Click "Save"**

### Step 3: Redeploy Vercel (CRITICAL!)

Environment variables don't update live sites automatically. You MUST redeploy:

1. **Click "Deployments"** (top menu)
2. **Find the most recent deployment** (top of list)
3. **Click the three dots (...)** button on that deployment
4. **Select "Redeploy"**
5. **Optional**: Uncheck **"Use existing Build Cache"** (forces fresh build)
6. **Click "Redeploy"**
7. **Wait for build to complete** (1-2 minutes)
8. **Status will change to "Ready"** ✅

---

## ✅ Part 3: Test Everything Works

### Test 1: Check Backend is Live

Visit: `https://your-backend-url.railway.app/health`

**Expected**: JSON response with `"status": "healthy"`

### Test 2: Check Frontend Connection

1. **Visit your Vercel site**: `https://wist-xxx.vercel.app/dashboard`
2. **Open Browser DevTools** (Press F12)
3. **Go to "Console" tab**
4. **Go to "Network" tab**
5. **Paste an Amazon URL** in the input field
6. **Click "Fetch"**

**Expected Results**:
- ✅ No errors in Console
- ✅ Network tab shows requests to your Railway backend URL
- ✅ Requests return `200 OK`
- ✅ Product data appears

### Test 3: Verify Environment Variable

1. **In Browser DevTools Console**, type:
   ```javascript
   console.log(process.env.NEXT_PUBLIC_SCRAPER_SERVICE_URL)
   ```
   - Or check Network tab → see requests going to your Railway URL

---

## 🐛 Troubleshooting

### Backend Health Check Fails

**Problem**: `https://your-backend-url.railway.app/health` returns error

**Solutions**:
1. Check Railway logs (Deployments tab → Click deployment → View logs)
2. Verify environment variables are set correctly
3. Check if deployment completed successfully
4. Wait a few minutes (Railway may need time to start)

### Frontend Still Shows Errors

**Problem**: Vercel site still can't reach backend

**Common Causes**:

1. **Trailing Slash**:
   - ❌ `https://backend.railway.app/`
   - ✅ `https://backend.railway.app`

2. **HTTP instead of HTTPS**:
   - ❌ `http://backend.railway.app`
   - ✅ `https://backend.railway.app`

3. **Wrong Variable Name**:
   - ❌ `NEXT_PUBLIC_SCRAPER_URL`
   - ✅ `NEXT_PUBLIC_SCRAPER_SERVICE_URL` (must match exactly!)

4. **Didn't Redeploy**:
   - Environment variables only apply after redeploy!

**Solution**:
- Double-check variable name and value in Vercel
- Make sure you redeployed after adding the variable
- Check Network tab to see what URL the frontend is trying to use

### "Mixed Content" Error

**Problem**: Browser blocks HTTP requests from HTTPS site

**Solution**: Ensure backend URL uses `https://` not `http://`

### Backend Returns 500 Error

**Problem**: Backend has errors

**Solutions**:
1. Check Railway logs for error messages
2. Verify Supabase environment variables are correct
3. Test backend health endpoint directly
4. Check if all dependencies installed correctly

---

## 📝 Quick Reference

### Backend Environment Variables (Railway)
```
SUPABASE_URL=https://ulmhmjqjtebaetocuhno.supabase.co
SUPABASE_KEY=your-service-role-key
PORT=5000
```

### Frontend Environment Variable (Vercel)
```
NEXT_PUBLIC_SCRAPER_SERVICE_URL=https://your-backend-url.railway.app
```

### Important URLs
- **Railway Dashboard**: https://railway.app
- **Vercel Dashboard**: https://vercel.com/dashboard
- **Supabase Dashboard**: https://supabase.com/dashboard/project/ulmhmjqjtebaetocuhno

---

## ✅ Success Checklist

- [ ] Backend deployed to Railway
- [ ] Backend health check works: `https://your-backend.railway.app/health`
- [ ] Backend URL copied (no trailing slash)
- [ ] Vercel environment variable added: `NEXT_PUBLIC_SCRAPER_SERVICE_URL`
- [ ] Vercel redeployed after adding variable
- [ ] Production site works: `https://wist-xxx.vercel.app`
- [ ] Product scraping works in production
- [ ] No console errors in browser
- [ ] Network requests show `200 OK`

---

## 🎉 You're Done!

Once all checks pass, your app is fully live:
- ✅ **Frontend**: Vercel (automatic deployments)
- ✅ **Backend**: Railway (24/7 uptime)
- ✅ **Database**: Supabase (caching enabled)

**Your scraper is now accessible worldwide! 🌍**

---

## 🔄 Alternative: Deploy to Render

If you prefer Render over Railway:

1. **Go to**: https://render.com
2. **Sign up/Login** with GitHub
3. **Click "New +"** → **"Web Service"**
4. **Connect your `Wist` repository**
5. **Configure**:
   - **Root Directory**: `scraper-service`
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `python app.py`
   - **Environment**: Python 3
6. **Add Environment Variables**:
   - `SUPABASE_URL=https://ulmhmjqjtebaetocuhno.supabase.co`
   - `SUPABASE_KEY=your-service-role-key`
7. **Click "Create Web Service"**
8. **Wait for deployment**
9. **Copy the URL** (e.g., `https://wist-scraper.onrender.com`)
10. **Follow Part 2 above** to connect Vercel

**Note**: Render free tier "sleeps" after inactivity. First request may take 30+ seconds to wake up.

