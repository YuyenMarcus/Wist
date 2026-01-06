# Integration Test Guide

## Prerequisites

1. **Install Dependencies**:
```bash
cd scraper-service
pip install -r requirements.txt
```

2. **Verify Crochet Installation**:
```bash
python -c "import crochet; print('Crochet version:', crochet.__version__)"
```

3. **Verify Scrapy Installation**:
```bash
python -c "import scrapy; print('Scrapy version:', scrapy.__version__)"
```

## Running the Stack

### Terminal 1: Python Scraper Service

```bash
cd scraper-service
python app.py
```

**Expected Output**:
```
Starting Wist Scraper Service...
Using crochet to manage Scrapy reactor
Service will be available at http://0.0.0.0:5000
 * Running on http://0.0.0.0:5000
```

### Terminal 2: Next.js Frontend

```bash
# In project root
npm run dev
```

**Expected Output**:
```
ready - started server on 0.0.0.0:3000
```

### Terminal 3: Environment Setup

Create `.env.local` in project root:
```env
NEXT_PUBLIC_SCRAPER_SERVICE_URL=http://localhost:5000
```

## Smoke Test

### Step 1: Health Check

```bash
curl http://localhost:5000/health
```

**Expected Response**:
```json
{
  "status": "healthy",
  "service": "wist-scraper",
  "python": true,
  "scrapy": true,
  "crochet": true
}
```

### Step 2: Create Async Job

```bash
curl -X POST http://localhost:5000/api/scrape \
  -H "Content-Type: application/json" \
  -d '{"url": "https://www.amazon.com/dp/B08N5WRWNW"}'
```

**Expected Response (202 Accepted)**:
```json
{
  "job_id": "uuid-here",
  "status": "processing",
  "url": "https://www.amazon.com/dp/B08N5WRWNW",
  "message": "Job created, polling /api/job/<job_id> for status"
}
```

### Step 3: Poll Job Status

```bash
curl http://localhost:5000/api/job/<job_id>
```

**Expected Responses**:

**While Processing**:
```json
{
  "job_id": "uuid-here",
  "status": "processing",
  "url": "https://...",
  "started_at": 1234567890.123
}
```

**When Completed**:
```json
{
  "job_id": "uuid-here",
  "status": "completed",
  "url": "https://...",
  "result": {
    "title": "Product Name",
    "price": 29.99,
    "priceRaw": "$29.99",
    "image": "https://...",
    "description": "...",
    "url": "https://..."
  },
  "completed_at": 1234567890.456
}
```

### Step 4: Browser Test

1. Open `http://localhost:3000` in Chrome
2. Open DevTools → Network Tab
3. Paste Amazon URL in the input field
4. Click "Fetch"

**Expected Network Activity**:
1. `POST /api/fetch-product-async` → Returns `job_id`
2. Multiple `GET /api/job-status/<job_id>` requests (polling every 2s)
3. Final `GET` returns `status: "completed"` with product data
4. UI updates with product preview

**Expected UI Behavior**:
- Shows engaging loading messages cycling every 1.5s
- Messages: "Locating product...", "Negotiating with server...", etc.
- Product preview appears when scraping completes

## Troubleshooting

### Issue: "ReactorAlreadyInstalledError"

**Cause**: Scrapy reactor already running
**Solution**: Ensure `crochet.setup()` is called BEFORE any Scrapy imports

### Issue: "Job stuck in processing"

**Cause**: Scrapy timeout or error
**Solution**: Check Python service logs for Scrapy errors

### Issue: "ModuleNotFoundError: No module named 'spiders'"

**Cause**: Running from wrong directory
**Solution**: Ensure you're in `scraper-service/` directory

### Issue: "Connection refused" from Next.js

**Cause**: Python service not running or wrong URL
**Solution**: 
- Verify Python service is running on port 5000
- Check `NEXT_PUBLIC_SCRAPER_SERVICE_URL` in `.env.local`

## Success Criteria

✅ Health check returns 200 OK
✅ Async job creation returns 202 with job_id
✅ Job status polling shows status progression
✅ Completed job returns product data
✅ Browser shows engaging loading messages
✅ Product preview appears after scraping
✅ Multiple requests don't crash the service (reactor stability)

## Next Steps After Successful Test

1. Deploy Python service to Railway/Fly.io
2. Update `NEXT_PUBLIC_SCRAPER_SERVICE_URL` in Vercel
3. Test production deployment
4. Monitor job completion times
5. Add Redis for persistent job queue (optional)









