# Quick Deploy Checklist 🚀

## Pre-Deployment Checklist

Before deploying to Render, make sure:

### ✅ 1. Files in Place
- [x] `Dockerfile` - Uses Microsoft Playwright image
- [x] `render.yaml` - Render configuration
- [x] `next.config.js` - Configured for production
- [x] `.dockerignore` - Excludes unnecessary files
- [x] `package.json` - Dependencies listed

### ✅ 2. Supabase Setup
- [ ] Run `supabase/schema.sql` in Supabase SQL Editor
- [ ] Get your Supabase URL from Settings → API
- [ ] Get your Supabase anon key
- [ ] Get your Supabase service role key (keep secret!)

### ✅ 3. Local Testing
```bash
# Build Docker image locally
docker build -t wist .

# Run locally (replace with your actual keys)
docker run -p 3000:3000 \
  -e NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co \
  -e NEXT_PUBLIC_SUPABASE_ANON_KEY=xxx \
  -e SUPABASE_SERVICE_ROLE_KEY=xxx \
  -e PLAYWRIGHT_BROWSERS_PATH=/ms-playwright \
  wist
```

Visit http://localhost:3000 and test:
- [ ] Homepage loads
- [ ] Try scraping a product (e.g., Target or Cascalia)
- [ ] Try scraping Amazon (should use Playwright)

### ✅ 4. GitHub Ready
- [ ] Code pushed to GitHub
- [ ] `render.yaml` is committed
- [ ] `Dockerfile` is committed
- [ ] `.env` is NOT committed (already in .gitignore)

## Deployment Steps

### Step 1: Create Render Service
1. Go to https://render.com
2. Click **"New +"** → **"Web Service"**
3. Connect your GitHub repository
4. Render will auto-detect `render.yaml`

### Step 2: Set Environment Variables
In Render dashboard → Your Service → Environment:

| Variable | Value |
|----------|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Your Supabase anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Your Supabase service role key |
| `PLAYWRIGHT_BROWSERS_PATH` | `/ms-playwright` |
| `NODE_ENV` | `production` |

### Step 3: Deploy
1. Click **"Create Web Service"**
2. Wait for build (3-5 minutes)
3. Check logs for any errors

### Step 4: Verify
1. Visit your Render URL (e.g., `https://wist-app.onrender.com`)
2. Test product scraping:
   - Simple site: Target, Cascalia
   - Dynamic site: Amazon, BestBuy
3. Check Render logs for:
   - ✓ "Browser launched" messages
   - ✓ Successful scrapes
   - ✗ Any error messages

## Common Issues & Solutions

### Build Fails
- **Check**: Node version compatibility (needs Node 18+)
- **Check**: Render free tier limits (memory/timeout)
- **Solution**: Consider upgrading to paid tier

### Playwright Not Working
- **Check**: `PLAYWRIGHT_BROWSERS_PATH` is set to `/ms-playwright`
- **Check**: Logs show "Browser launched"
- **Solution**: Verify Dockerfile uses Microsoft Playwright image

### Environment Variables Not Found
- **Check**: Variables start with `NEXT_PUBLIC_` for client-side
- **Check**: Variables are set in Render dashboard
- **Solution**: Restart service after adding new vars

### 403 Errors from Sites
- **Expected**: Sites like Amazon block automation
- **Solution**: Check `scrape_errors` table in Supabase for analytics
- **Note**: This is normal - some sites require manual entry

## Post-Deployment

### Monitor
- [ ] Check Render logs regularly
- [ ] Monitor Supabase `scrape_errors` table
- [ ] Check Render metrics (CPU, Memory)

### Update Supabase Schema
Run this in Supabase SQL Editor if you haven't:
```sql
-- See supabase/schema.sql for full schema
-- This creates wishlist_items and scrape_errors tables
```

### Test Different Sites
- [ ] Amazon (requires Playwright)
- [ ] BestBuy (requires Playwright)
- [ ] Target (static scraping)
- [ ] eBay (requires Playwright)
- [ ] Cascalia (static scraping)

---

**Ready to deploy?** Follow `RENDER_DEPLOY.md` for detailed instructions!

