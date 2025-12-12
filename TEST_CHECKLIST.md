# ✅ Testing Checklist

## Step 1: Start Services

Run the startup script:
```bash
# Option 1: Double-click
start_app.bat

# Option 2: PowerShell
powershell -ExecutionPolicy Bypass -File start_app.ps1
```

**Expected Result:**
- ✅ Two new windows open (Flask backend + Next.js frontend)
- ✅ Backend shows: "Starting Wist Scraper Service..."
- ✅ Frontend shows: "Ready on http://localhost:3000"

---

## Step 2: Verify Services Are Running

### Backend Health Check
Open browser: http://localhost:5000/health

**Expected Response:**
```json
{
  "status": "healthy",
  "service": "wist-scraper",
  "python": true,
  "scrapy": true,
  "crochet": true
}
```

### Frontend Check
Open browser: http://localhost:3000

**Expected:**
- ✅ Homepage loads
- ✅ Navigation works
- ✅ Dashboard accessible at http://localhost:3000/dashboard

---

## Step 3: Test Product Scraping

1. **Go to Dashboard**: http://localhost:3000/dashboard

2. **Test Amazon URL**:
   - Paste: `https://www.amazon.com/dp/B08XYZ...` (any Amazon product)
   - Click **"Fetch"**

3. **Watch Backend Console**:
   - Look for: `✅ Supabase connected for caching`
   - Look for: `🔔 Request received for: https://...`
   - **Goal**: See `200 OK` response
   - **Goal**: NO `PGRST204` errors
   - **Goal**: See scraping logs or cache hit message

4. **Check Frontend**:
   - Product preview should appear
   - Image should be high-resolution (not 1x1 placeholder)
   - Title and price should be populated

---

## Step 4: Test Supabase Caching

1. **First Request**:
   - Scrape a product URL
   - Check backend console: Should see scraping logs
   - Takes ~3-5 seconds

2. **Second Request (Same URL)**:
   - Scrape the SAME URL again
   - Check backend console: Should see `✅ Found in Cache (Database): ...`
   - Should be **INSTANT** (< 0.5 seconds)

3. **Verify in Supabase**:
   - Go to Supabase Dashboard → Table Editor → `products` table
   - Should see the scraped product with all fields populated

---

## ✅ Success Criteria

### Backend Console Should Show:
- ✅ `✅ Supabase connected for caching` (on startup)
- ✅ `🔔 Request received for: [URL]`
- ✅ Either:
  - `✅ Found in Cache (Database): [title]...` (cache hit)
  - OR scraping logs followed by `✅ Saved to Supabase cache: [title]...` (cache miss)

### Backend Console Should NOT Show:
- ❌ `PGRST204` errors
- ❌ `Supabase not configured` warnings
- ❌ Database connection errors
- ❌ `Table not found` errors

### Frontend Should Show:
- ✅ Product preview card with:
  - High-resolution image (not 1x1 placeholder)
  - Product title
  - Price (if available)
  - "Save Item" button works

---

## 🐛 Troubleshooting

### Backend Not Starting
- Check if port 5000 is already in use
- Verify Python dependencies: `cd scraper-service && pip install -r requirements.txt`
- Check `scraper-service/.env` exists with Supabase keys

### Frontend Not Starting
- Check if port 3000 is already in use
- Verify Node dependencies: `npm install`
- Check for build errors: `npm run build`

### Supabase Errors
- Verify `.env.local` has `SUPABASE_SERVICE_ROLE_KEY`
- Verify `scraper-service/.env` has `SUPABASE_URL` and `SUPABASE_KEY`
- Check Supabase Dashboard → Table Editor → `products` table exists
- Verify RLS policies are set correctly

### Image Still 1x1 Placeholder
- Check backend console for image extraction logs
- Verify Amazon spider is using new image extraction logic
- Test with different Amazon product URLs

---

## 🎉 Ready for Deployment?

If all checks pass:
- ✅ Services start correctly
- ✅ Backend health check works
- ✅ Product scraping works
- ✅ Supabase caching works
- ✅ No PGRST204 errors
- ✅ Images are high-resolution

**You're ready to deploy!** Follow `DEPLOYMENT_GUIDE.md` or `VERCEL_DEPLOY.md`


