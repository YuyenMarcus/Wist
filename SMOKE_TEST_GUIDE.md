# Smoke Test Guide - Payload Verification

## Purpose

Verify that the Python backend returns data in the exact format the TypeScript frontend expects. This test will reveal:
1. **Option A (Success)**: Proper product data extracted
2. **Option B (Captcha Trap)**: Amazon served a robot check page instead

## Test Steps

### 1. Start Services

**Terminal 1 - Python Service**:
```bash
cd scraper-service
python app.py
```

**Terminal 2 - Next.js**:
```bash
npm run dev
```

### 2. Run Smoke Test

1. Open `http://localhost:3000` in Chrome
2. Open DevTools → **Network Tab**
3. Paste an Amazon URL (e.g., `https://www.amazon.com/dp/B08N5WRWNW`)
4. Click "Fetch"
5. Watch the Network tab for requests

### 3. Find the Final Response

Look for the final `GET /api/job-status/<job_id>` request that returns `status: "completed"`.

Click on it → **Response** tab → Check the JSON payload.

## Expected Payload Formats

### Option A: Success ✅

```json
{
  "success": true,
  "job_id": "uuid-here",
  "status": "completed",
  "url": "https://www.amazon.com/dp/...",
  "result": {
    "title": "Sony WH-1000XM5 Wireless Noise Canceling Headphones...",
    "price": 348.00,
    "priceRaw": "$348.00",
    "currency": "USD",
    "image": "https://m.media-amazon.com/images/I/51+...",
    "description": "Industry-leading noise canceling with Dual Noise Sensor technology...",
    "url": "https://www.amazon.com/dp/..."
  },
  "completed_at": 1234567890.123
}
```

**Indicators of Success**:
- ✅ `status: "completed"`
- ✅ `result.title` contains actual product name (not "Amazon.com")
- ✅ `result.price` is a number (not null)
- ✅ `result.image` is a valid URL (not null)

### Option B: Captcha Trap ❌

```json
{
  "success": true,
  "job_id": "uuid-here",
  "status": "failed",
  "url": "https://www.amazon.com/dp/...",
  "error": "Captcha/robot check detected. Site is blocking automated access.",
  "completed_at": 1234567890.123
}
```

**OR** (if detection fails):

```json
{
  "success": true,
  "job_id": "uuid-here",
  "status": "completed",
  "url": "https://www.amazon.com/dp/...",
  "result": {
    "title": "Amazon.com",
    "price": null,
    "priceRaw": null,
    "currency": "USD",
    "image": null,
    "description": null,
    "url": "https://www.amazon.com/dp/..."
  }
}
```

**Indicators of Captcha Trap**:
- ❌ `result.title` is just "Amazon.com" or site name
- ❌ `result.price` is null
- ❌ `result.image` is null
- ❌ OR `status: "failed"` with captcha error message

## What Happens Next

### If You Got Option A (Success) ✅

**Path 1: Data Persistence**
- The scraper works! 
- Move to Sprint 2: Upgrade LocalStorage to handle `priceHistory` array
- OR connect Supabase for multi-user support
- See `DATA_PERSISTENCE_PLAN.md`

### If You Got Option B (Captcha Trap) ❌

**Path 2: Tune Stealth Settings**
- Amazon is detecting the scraper
- Need to enhance anti-bot measures
- See `STEALTH_TUNING_GUIDE.md`
- Options:
  - Rotate User-Agents more aggressively
  - Add more realistic browser headers
  - Implement proxy rotation
  - Add delays between requests
  - Use residential proxies

## Current Captcha Detection

The service now includes automatic captcha detection in `app.py`:

```python
def detect_captcha_trap(data):
    """Detect if we got a captcha/robot check page"""
    # Checks for:
    # - Title is just site name (e.g., "Amazon.com")
    # - No price and no image
    # - Captcha keywords in title
```

If detected, the job status will be `"failed"` with error message.

## Troubleshooting

### No Response in Network Tab
- Check if Python service is running
- Verify `NEXT_PUBLIC_SCRAPER_SERVICE_URL` in `.env.local`
- Check browser console for errors

### Job Stuck in "processing"
- Check Python service logs
- Verify URL is accessible
- Check for Scrapy errors

### Wrong Payload Structure
- Verify `scraper-service/app.py` returns `result` (not `data`)
- Check `pages/api/job-status/[jobId].ts` proxies correctly
- Ensure TypeScript client expects `status.result`

## Next Steps After Test

1. **Document your result**: Option A or Option B?
2. **If Option A**: Proceed to data persistence
3. **If Option B**: Tune stealth settings (see next guide)


