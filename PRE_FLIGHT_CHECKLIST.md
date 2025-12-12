# ✅ Pre-Flight Checklist: Before Redeploying Vercel

## 🎯 Why This Matters

Your Vercel frontend lives on Vercel's servers. If it tries to call `localhost:5000`, it's looking for a backend that doesn't exist on Vercel's servers or your user's computer.

**Solution**: Point Vercel to your deployed backend URL (Railway/Render).

---

## ✅ Checklist Before Redeploy

### 1. Backend is Deployed ✅
- [ ] Backend deployed to Railway or Render
- [ ] Backend has a public HTTPS URL
- [ ] Backend health check works: `https://your-backend.com/health`
- [ ] Backend returns `200 OK` on health check

### 2. Backend URL is Correct ✅

**The "Slash" Trap:**
- [ ] ❌ NOT: `https://my-backend.railway.app/` (has trailing slash)
- [ ] ✅ YES: `https://my-backend.railway.app` (no trailing slash!)

**The "HTTPS" Check:**
- [ ] ❌ NOT: `http://my-backend.com` (insecure)
- [ ] ✅ YES: `https://my-backend.com` (secure)

**Example Format:**
```
✅ https://wist-scraper-production.up.railway.app
✅ https://wist-scraper.onrender.com
```

### 3. Vercel Environment Variable is Set ✅
- [ ] Variable name: `NEXT_PUBLIC_SCRAPER_SERVICE_URL` (exact spelling)
- [ ] Variable value: Your backend HTTPS URL (no trailing slash)
- [ ] Environment: All (Production, Preview, Development)
- [ ] Variable is saved

### 4. Ready to Redeploy ✅
- [ ] All checks above pass
- [ ] Backend is running and accessible
- [ ] Ready to click "Redeploy" in Vercel

---

## 🚀 After Redeploy

### Test Production Site
1. Visit: `https://wist-xxx.vercel.app/dashboard`
2. Try scraping a product
3. Check browser console (F12) for errors

### Expected Results
- ✅ Product scraping works
- ✅ No "Server returned invalid response" errors
- ✅ No "Mixed Content" errors
- ✅ Network requests show `200 OK`

### If First Request Fails (Render Free Tier)
- ⏳ **Cold Start**: Render free tier "sleeps" after inactivity
- ⏳ First request may take 30+ seconds
- ✅ **Solution**: Wait 10 seconds and try again
- ✅ Subsequent requests will be fast

---

## 🐛 Common Mistakes

### ❌ Mistake 1: Trailing Slash
```
❌ https://backend.railway.app/
✅ https://backend.railway.app
```

### ❌ Mistake 2: HTTP Instead of HTTPS
```
❌ http://backend.railway.app
✅ https://backend.railway.app
```

### ❌ Mistake 3: Localhost in Production
```
❌ http://localhost:5000
✅ https://your-backend.railway.app
```

### ❌ Mistake 4: Forgot to Redeploy
```
❌ Added env var but didn't redeploy
✅ Added env var AND clicked "Redeploy"
```

---

## 📊 Architecture Visualization

### ❌ What Happens with Localhost:
```
User Browser → Vercel Frontend → localhost:5000 ❌
                                    ↑
                              Doesn't exist on Vercel's servers!
```

### ✅ What Happens with Deployed Backend:
```
User Browser → Vercel Frontend → Railway/Render Backend ✅
                                    ↑
                              Public HTTPS URL accessible from anywhere!
```

---

## 🎉 Success Indicators

Once everything is set up correctly:
- ✅ Vercel frontend can reach your backend
- ✅ Product scraping works in production
- ✅ No console errors
- ✅ Fast response times (after cold start)

**You're live! 🚀**


