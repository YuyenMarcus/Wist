# Render Deployment Guide

This guide walks you through deploying your Wist Next.js app to Render.

## 📁 Folder Structure

Your project should have this structure:

```
wist/
├─ package.json
├─ next.config.js
├─ tsconfig.json
├─ .env (not committed - set in Render dashboard)
├─ Dockerfile
├─ render.yaml
├─ /pages
│  ├─ api/
│  │  └─ fetch-product.ts
│  ├─ _app.tsx
│  └─ index.tsx
├─ /components
│  ├─ AddProductForm.tsx
│  └─ ProductPreview.tsx
└─ /lib
   ├─ scraper/
   └─ supabase/
```

## 🐳 Dockerfile

The Dockerfile uses Microsoft's official Playwright image which includes Chromium pre-installed:

```dockerfile
FROM mcr.microsoft.com/playwright:v1.47.0-jammy
```

**Benefits:**
- No manual browser installation needed
- All dependencies pre-configured
- Fully compatible with Render free tier
- Smaller image size

## ⚙️ render.yaml

The `render.yaml` file tells Render how to build and run your app:

- **Type**: Web service (Node.js)
- **Region**: Oregon (change if needed)
- **Plan**: Free tier
- **Environment Variables**: Configured for Supabase and Playwright

## 🔑 Step 1: Environment Variables

Before deploying, you need to set these in Render's dashboard:

1. Go to your service → **Environment** → **Add Environment Variable**

### Required Variables:

| Key | Value | Notes |
|-----|-------|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase project URL | Get from Supabase dashboard → Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Anon key from Supabase | Public key (safe to expose) |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key | Private key (server-side only) |
| `PLAYWRIGHT_BROWSERS_PATH` | `/ms-playwright` | Set by Dockerfile, but include here |
| `NODE_ENV` | `production` | Already in render.yaml |

### Optional:

| Key | Value |
|-----|-------|
| `NEXT_PUBLIC_BASE_URL` | `https://wist-app.onrender.com` (or your Render URL) |

## 🧪 Step 2: Test Locally

Before deploying to Render, test the Docker build locally:

```bash
# Build the Docker image
docker build -t wist .

# Run the container
docker run -p 3000:3000 \
  -e NEXT_PUBLIC_SUPABASE_URL=your-url \
  -e NEXT_PUBLIC_SUPABASE_ANON_KEY=your-key \
  -e SUPABASE_SERVICE_ROLE_KEY=your-key \
  -e PLAYWRIGHT_BROWSERS_PATH=/ms-playwright \
  wist
```

Then visit **http://localhost:3000**

If it loads correctly, you're ready to deploy!

## 🚀 Step 3: Deploy to Render

### Option A: Using render.yaml (Recommended)

1. **Push to GitHub**
   ```bash
   git add .
   git commit -m "Add Render deployment config"
   git push origin main
   ```

2. **Create Render Service**
   - Go to https://render.com
   - Click **"New +"** → **"Web Service"**
   - Connect your GitHub repository
   - Render will auto-detect `render.yaml`

3. **Set Environment Variables**
   - In the Render dashboard, go to your service
   - Navigate to **Environment**
   - Add all required variables (see Step 1)

4. **Deploy**
   - Click **"Create Web Service"**
   - Render will build and deploy automatically
   - Wait for build to complete (usually 3-5 minutes)

### Option B: Manual Configuration

If you prefer not to use `render.yaml`:

1. **Create Web Service** in Render dashboard
2. **Connect GitHub repo**
3. **Settings**:
   - **Environment**: Node
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm start`
   - **Auto-Deploy**: Yes (from main branch)
4. **Add Environment Variables** (same as Step 1)
5. **Create Service**

## ✅ Step 4: Verification

After deployment completes:

### 1. Health Check
Visit your Render URL (e.g., `https://wist-app.onrender.com`)

### 2. Test Product Scraping

**Test a simple site:**
- Try Cascalia or Target (should work immediately)

**Test a dynamic site:**
- Try Amazon or BestBuy (requires Playwright)
- Check Render logs for "Browser launched" message

### 3. Check Render Logs

Go to **Logs** tab in Render dashboard and look for:
```
✓ Browser launched successfully
✓ Playwright scraping...
```

If you see errors, check:
- Environment variables are set correctly
- Supabase schema is set up (run `supabase/schema.sql`)
- Playwright browsers path is correct

## 🔍 Troubleshooting

### Build Fails

**Issue**: Build timeout or memory issues
**Solution**: 
- Render free tier has limits
- Try upgrading to paid tier or optimize build

### Playwright Not Found

**Issue**: `Cannot find module 'playwright'` or browser errors
**Solution**:
- Verify `PLAYWRIGHT_BROWSERS_PATH=/ms-playwright` is set
- Check Dockerfile uses correct Playwright image

### Environment Variables Not Working

**Issue**: `NEXT_PUBLIC_*` vars not accessible in browser
**Solution**:
- Ensure variables start with `NEXT_PUBLIC_`
- Restart service after adding new env vars

### 403 Errors from Sites

**Issue**: Getting blocked by Amazon/BestBuy/etc.
**Solution**:
- This is expected - sites detect automation
- Check error analytics in Supabase `scrape_errors` table
- Consider using the separate scraper service for heavy scraping

## 📊 Monitoring

### Render Dashboard
- **Logs**: Real-time application logs
- **Metrics**: CPU, Memory, Request count
- **Events**: Deployments, errors, scaling events

### Supabase Dashboard
- **Error Analytics**: Check `scrape_errors` table
- **Wishlist Items**: View `wishlist_items` table

## 🔄 Updating the App

Every push to `main` branch will automatically trigger a new deployment.

To manually deploy:
- Go to Render dashboard → Your service → **Manual Deploy** → **Deploy latest commit**

## 🎉 Success!

Once deployed, your app will:
- ✅ Handle product scraping with Playwright
- ✅ Save wishlist items to Supabase
- ✅ Work with Amazon, BestBuy, Target, eBay, etc.
- ✅ Cache results for 6 hours
- ✅ Rate limit per domain (5s intervals)
- ✅ Log errors to Supabase for analytics

---

**Need Help?**
- Check Render docs: https://render.com/docs
- Check logs in Render dashboard
- Review error analytics in Supabase

