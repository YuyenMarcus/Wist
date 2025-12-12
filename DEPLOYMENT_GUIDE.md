# 🚀 Deployment Guide: From Local to Production

## Overview

Your Wist app has two parts:
- **Frontend (Next.js)**: User interface → Deploy to **Vercel** (Free)
- **Backend (Flask)**: Scraper service → Deploy to **Railway** or **Render** (Free tier available)

---

## 📦 Part 1: Deploy Frontend to Vercel

### Why Vercel?
- ✅ **Free** for Next.js apps
- ✅ **Automatic deployments** from GitHub
- ✅ **CDN** for fast global access
- ✅ **Zero configuration** needed

### Steps:

1. **Push your code to GitHub** (if not already done)
   ```bash
   git add .
   git commit -m "Ready for deployment"
   git push origin main
   ```

2. **Go to Vercel**: https://vercel.com
   - Sign up/login with GitHub
   - Click **"Add New Project"**
   - Import your `YuyenMarcus/Wist` repository

3. **Configure Environment Variables**
   - In Vercel project settings → Environment Variables
   - Add these:
     ```
     NEXT_PUBLIC_SUPABASE_URL=https://ulmhmjqjtebaetocuhno.supabase.co
     NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
     SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
     NEXT_PUBLIC_SCRAPER_SERVICE_URL=https://your-backend-url.railway.app
     ```

4. **Deploy**
   - Click **"Deploy"**
   - Vercel will automatically build and deploy
   - You'll get a URL like: `https://wist.vercel.app`

✅ **Frontend is now live!**

---

## 🐍 Part 2: Deploy Backend to Railway

### Why Railway?
- ✅ **Free tier** (500 hours/month)
- ✅ **Automatic deployments** from GitHub
- ✅ **Easy environment variables**
- ✅ **Built-in Python support**

### Steps:

1. **Prepare for Deployment**
   - Make sure `scraper-service/requirements.txt` is up to date
   - Create `scraper-service/Procfile` (I'll create this for you)

2. **Go to Railway**: https://railway.app
   - Sign up/login with GitHub
   - Click **"New Project"** → **"Deploy from GitHub repo"**
   - Select your `Wist` repository

3. **Configure Service**
   - Railway will auto-detect it's a Python app
   - Set **Root Directory** to: `scraper-service`
   - Set **Start Command** to: `python app.py` (or use Procfile)

4. **Add Environment Variables**
   - In Railway project → Variables
   - Add:
     ```
     SUPABASE_URL=https://ulmhmjqjtebaetocuhno.supabase.co
     SUPABASE_KEY=your-service-role-key
     PORT=5000
     ```

5. **Deploy**
   - Railway will automatically deploy
   - You'll get a URL like: `https://wist-backend.railway.app`
   - Update your Vercel env var: `NEXT_PUBLIC_SCRAPER_SERVICE_URL`

✅ **Backend is now live!**

---

## 🐳 Alternative: Deploy Backend to Render

### Why Render?
- ✅ **Free tier** available
- ✅ **Simple setup**
- ✅ **Auto-deploy from GitHub**

### Steps:

1. **Go to Render**: https://render.com
   - Sign up/login with GitHub
   - Click **"New +"** → **"Web Service"**

2. **Connect Repository**
   - Select your `Wist` repository
   - Set **Root Directory** to: `scraper-service`

3. **Configure**
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
   - Render will build and deploy
   - You'll get a URL like: `https://wist-backend.onrender.com`

✅ **Backend is now live!**

---

## 🔧 Part 3: Create Procfile for Railway/Render

I'll create this file for you to ensure proper startup.

---

## 📝 Part 4: Update Frontend to Use Production Backend

After deploying backend, update your Vercel environment variable:
```
NEXT_PUBLIC_SCRAPER_SERVICE_URL=https://your-backend-url.railway.app
```

---

## ✅ Deployment Checklist

### Frontend (Vercel)
- [ ] Code pushed to GitHub
- [ ] Vercel project created
- [ ] Environment variables set
- [ ] Deployed successfully
- [ ] Frontend URL works

### Backend (Railway/Render)
- [ ] Procfile created
- [ ] Railway/Render project created
- [ ] Environment variables set
- [ ] Deployed successfully
- [ ] Backend URL accessible
- [ ] Health check works: `https://your-backend-url/health`

### Integration
- [ ] Frontend env var updated with backend URL
- [ ] Test product scraping end-to-end
- [ ] Verify Supabase caching works

---

## 🎯 Quick Start Commands

### Local Development (Windows)
```bash
# Option 1: Double-click start_app.bat
# Option 2: Run PowerShell script
powershell -ExecutionPolicy Bypass -File start_app.ps1
```

### Production
- Frontend: Automatically deployed via Vercel
- Backend: Automatically deployed via Railway/Render
- **No manual commands needed!**

---

## 💰 Cost Breakdown

| Service | Tier | Cost |
|---------|------|------|
| Vercel | Hobby | **Free** |
| Railway | Starter | **Free** (500 hrs/month) |
| Render | Free | **Free** (with limitations) |
| Supabase | Free | **Free** (up to 500MB) |

**Total: $0/month** for starting out! 🎉

---

## 🐛 Troubleshooting

### Backend not starting
- Check Railway/Render logs
- Verify `requirements.txt` has all dependencies
- Check environment variables are set

### Frontend can't reach backend
- Verify `NEXT_PUBLIC_SCRAPER_SERVICE_URL` is correct
- Check CORS settings in Flask app
- Test backend health endpoint directly

### Supabase connection fails
- Verify environment variables match
- Check Supabase dashboard for API keys
- Ensure service role key is used (not anon key)

---

## 🚀 Next Steps After Deployment

1. **Custom Domain** (Optional)
   - Add custom domain in Vercel
   - Point DNS to Vercel

2. **Monitoring**
   - Set up error tracking (Sentry)
   - Monitor Railway/Render usage

3. **Scaling**
   - Upgrade Railway/Render if needed
   - Add caching layer (Redis)
   - Optimize database queries

---

**You're now running a production-grade scraper service! 🎉**


