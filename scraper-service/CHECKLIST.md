# Integration Test Checklist

## Pre-Flight Checks

- [ ] Python 3.11+ installed
- [ ] Dependencies installed: `pip install -r requirements.txt`
- [ ] Crochet installed: `python -c "import crochet; print('OK')"`
- [ ] Scrapy installed: `python -c "import scrapy; print('OK')"`
- [ ] Flask installed: `python -c "import flask; print('OK')"`

## Terminal Setup

### Terminal 1: Python Service
```bash
cd scraper-service
python app.py
```

**Expected**: 
```
============================================================
Starting Wist Scraper Service...
Using crochet to manage Scrapy reactor
Service will be available at http://0.0.0.0:5000
============================================================
 * Running on http://0.0.0.0:5000
```

### Terminal 2: Next.js Frontend
```bash
npm run dev
```

**Expected**: `ready - started server on 0.0.0.0:3000`

### Terminal 3: Environment
Create `.env.local`:
```env
NEXT_PUBLIC_SCRAPER_SERVICE_URL=http://localhost:5000
```

## Test Sequence

### 1. Health Check
```bash
curl http://localhost:5000/health
```
- [ ] Returns 200 OK
- [ ] JSON response with `"status": "healthy"`
- [ ] Includes `"crochet": true`

### 2. Create Async Job
```bash
curl -X POST http://localhost:5000/api/scrape \
  -H "Content-Type: application/json" \
  -d '{"url": "https://www.amazon.com/dp/B08N5WRWNW"}'
```
- [ ] Returns 202 Accepted
- [ ] Contains `job_id`
- [ ] Status is `"processing"`

### 3. Poll Job Status
```bash
curl http://localhost:5000/api/job/<job_id>
```
- [ ] First poll: status is `"processing"`
- [ ] Subsequent polls: status changes to `"completed"`
- [ ] Final response contains `result` with product data

### 4. Browser Test
- [ ] Open `http://localhost:3000`
- [ ] Open DevTools → Network Tab
- [ ] Paste Amazon URL
- [ ] Click "Fetch"
- [ ] See engaging loading messages
- [ ] See POST to `/api/fetch-product-async`
- [ ] See multiple GETs to `/api/job-status/<job_id>`
- [ ] Product preview appears

### 5. Reactor Stability Test
- [ ] Make second request (different URL)
- [ ] Service doesn't crash
- [ ] Second job completes successfully
- [ ] No "ReactorAlreadyInstalledError"

## Success Criteria

✅ All health checks pass
✅ Async jobs complete successfully
✅ Product data extracted correctly
✅ UI shows engaging loading messages
✅ Multiple requests don't crash service
✅ Reactor remains stable across requests

## Common Issues

### "ReactorAlreadyInstalledError"
- **Fix**: Ensure `crochet.setup()` is called BEFORE Scrapy imports
- **Check**: Look at top of `app.py` - setup() should be first

### "ModuleNotFoundError: No module named 'spiders'"
- **Fix**: Run from `scraper-service/` directory
- **Check**: `ls spiders/` should show `__init__.py` and `product_spider.py`

### Jobs stuck in "processing"
- **Check**: Python service logs for Scrapy errors
- **Fix**: Verify URL is accessible, check network connectivity

### Connection refused from Next.js
- **Fix**: Verify Python service is running on port 5000
- **Check**: `NEXT_PUBLIC_SCRAPER_SERVICE_URL` in `.env.local`


