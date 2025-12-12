# ✅ Backend Deployment Checklist

## 🎯 Quick Checklist

### Step 1: Deploy Backend (Railway)
- [ ] Created Railway account (https://railway.app)
- [ ] Created new project from GitHub repo
- [ ] Set Root Directory to `scraper-service`
- [ ] Added environment variable: `SUPABASE_URL=https://ulmhmjqjtebaetocuhno.supabase.co`
- [ ] Added environment variable: `SUPABASE_KEY=your-service-role-key`
- [ ] Added environment variable: `PORT=5000`
- [ ] Deployment completed successfully
- [ ] Generated public domain
- [ ] Copied backend URL (NO trailing slash!)
- [ ] Tested health endpoint: `https://your-backend.railway.app/health` ✅

### Step 2: Connect Vercel
- [ ] Went to Vercel Dashboard → Settings → Environment Variables
- [ ] Added variable: `NEXT_PUBLIC_SCRAPER_SERVICE_URL`
- [ ] Set value to backend URL (NO trailing slash, use HTTPS)
- [ ] Selected all environments (Production, Preview, Development)
- [ ] Saved the variable
- [ ] Redeployed Vercel (Deployments → Redeploy latest)

### Step 3: Test
- [ ] Backend health check works
- [ ] Vercel site loads
- [ ] Product scraping works in production
- [ ] No console errors
- [ ] Network requests show 200 OK

---

## ⚠️ Common Mistakes to Avoid

### ❌ The "Slash" Trap
- ❌ `https://backend.railway.app/` (has trailing slash)
- ✅ `https://backend.railway.app` (no trailing slash!)

### ❌ The "HTTPS" Check
- ❌ `http://backend.com` (insecure, browsers block it)
- ✅ `https://backend.com` (must use HTTPS!)

### ❌ Wrong Variable Name
- ❌ `NEXT_PUBLIC_SCRAPER_URL`
- ✅ `NEXT_PUBLIC_SCRAPER_SERVICE_URL` (must match exactly!)

### ❌ Forgot to Redeploy
- Environment variables don't update live sites automatically
- **MUST redeploy Vercel after adding/updating variables!**

---

## 🔗 Quick Links

- **Railway Dashboard**: https://railway.app
- **Vercel Dashboard**: https://vercel.com/dashboard
- **Supabase Dashboard**: https://supabase.com/dashboard/project/ulmhmjqjtebaetocuhno

---

## 📋 Environment Variables Reference

### Railway (Backend)
```
SUPABASE_URL=https://ulmhmjqjtebaetocuhno.supabase.co
SUPABASE_KEY=your-service-role-key
PORT=5000
```

### Vercel (Frontend)
```
NEXT_PUBLIC_SCRAPER_SERVICE_URL=https://your-backend.railway.app
```

---

**See `DEPLOY_BACKEND_NOW.md` for detailed step-by-step instructions.**

