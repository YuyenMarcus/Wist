# 🚀 Deploy to Vercel - Quick Guide

## Step 1: Push to GitHub ✅

Your code is now pushed to: `https://github.com/YuyenMarcus/Wist.git`

## Step 2: Deploy to Vercel

### Option A: Via Vercel Dashboard (Recommended)

1. **Go to Vercel**: https://vercel.com
   - Sign up/login (use GitHub to connect)

2. **Import Project**
   - Click **"Add New Project"**
   - Click **"Import Git Repository"**
   - Select `YuyenMarcus/Wist`
   - Click **"Import"**

3. **Configure Project**
   - **Framework Preset**: Next.js (auto-detected)
   - **Root Directory**: `./` (leave as default)
   - **Build Command**: `npm run build` (auto-detected)
   - **Output Directory**: `.next` (auto-detected)
   - Click **"Deploy"**

4. **Add Environment Variables**
   - After first deployment, go to **Settings** → **Environment Variables**
   - Add these variables:

   ```
   NEXT_PUBLIC_SUPABASE_URL=https://ulmhmjqjtebaetocuhno.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
   NEXT_PUBLIC_SCRAPER_SERVICE_URL=http://localhost:5000
   ```

   ⚠️ **Important**: 
   - For `NEXT_PUBLIC_SCRAPER_SERVICE_URL`, use your backend URL once deployed
   - If backend isn't deployed yet, you can update this later

5. **Redeploy**
   - After adding env vars, go to **Deployments** tab
   - Click **"Redeploy"** on the latest deployment
   - Select **"Use existing Build Cache"** → **"Redeploy"**

### Option B: Via Vercel CLI

```bash
# Install Vercel CLI
npm i -g vercel

# Login
vercel login

# Deploy
vercel

# Follow prompts:
# - Set up and deploy? Yes
# - Which scope? (select your account)
# - Link to existing project? No
# - Project name? wist
# - Directory? ./
# - Override settings? No
```

Then add environment variables via dashboard or CLI:
```bash
vercel env add NEXT_PUBLIC_SUPABASE_URL
vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY
vercel env add SUPABASE_SERVICE_ROLE_KEY
vercel env add NEXT_PUBLIC_SCRAPER_SERVICE_URL
```

## Step 3: Verify Deployment

1. **Check Build Logs**
   - Go to your project → **Deployments** tab
   - Click on the latest deployment
   - Check **Build Logs** for any errors

2. **Test Your Site**
   - Visit your Vercel URL: `https://wist-xxx.vercel.app`
   - Test the dashboard: `https://wist-xxx.vercel.app/dashboard`

## Step 4: Update Backend URL (After Backend Deployment)

Once you deploy your Flask backend to Railway/Render:

1. Go to Vercel → **Settings** → **Environment Variables**
2. Update `NEXT_PUBLIC_SCRAPER_SERVICE_URL`:
   ```
   NEXT_PUBLIC_SCRAPER_SERVICE_URL=https://your-backend.railway.app
   ```
3. **Redeploy** to apply changes

## 🎯 Environment Variables Checklist

Make sure these are set in Vercel:

- ✅ `NEXT_PUBLIC_SUPABASE_URL`
- ✅ `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- ✅ `SUPABASE_SERVICE_ROLE_KEY`
- ⚠️ `NEXT_PUBLIC_SCRAPER_SERVICE_URL` (update after backend deploy)

## 🐛 Troubleshooting

### Build Fails
- Check build logs in Vercel dashboard
- Verify all dependencies are in `package.json`
- Ensure `npm run build` works locally

### Environment Variables Not Working
- Make sure variables start with `NEXT_PUBLIC_` for client-side access
- Redeploy after adding env vars
- Check variable names match exactly (case-sensitive)

### API Routes Not Working
- Verify backend URL is correct
- Check CORS settings in Flask app
- Test backend health endpoint directly

## 🎉 Success!

Once deployed, you'll have:
- ✅ Live frontend at `https://wist-xxx.vercel.app`
- ✅ Automatic deployments on every git push
- ✅ Free SSL certificate
- ✅ Global CDN

**Your app is now live! 🚀**








