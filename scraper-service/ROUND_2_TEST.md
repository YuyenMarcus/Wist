# Round 2 Stealth Test - Execute Now

## Current Status

✅ **Stealth Mode Implemented**:
- User-Agent rotation enabled
- Realistic Chrome headers
- Google referer
- Human-like delays (2-10 seconds)
- Cookies disabled

## Expectations

**Home WiFi (Residential IP)**: ~60% success rate
- Your IP looks like a real user
- Stealth headers should be enough

**Cloud Server (AWS/DigitalOcean)**: ~10% success rate
- Datacenter IP is flagged
- TLS fingerprinting detects Python/Twisted
- Need Playwright (real browser) fallback

## Execute Test

### Step 1: Restart Python Service

```bash
cd scraper-service
# Press CTRL+C to stop
python app.py
```

**Verify**: Service restarts and shows "Running on http://0.0.0.0:5000"

### Step 2: Test in Frontend

1. Open `http://localhost:3000`
2. Open DevTools → Network Tab
3. Paste Amazon URL
4. Click "Fetch"
5. **Wait 5-10 seconds** (new delays in effect)

### Step 3: Check Result

Look at the final `GET /api/job-status/<job_id>` response.

## Report Your Result

### Scenario A: Success ✅

**Response looks like**:
```json
{
  "status": "completed",
  "result": {
    "title": "Sony WH-1000XM5 Wireless Noise Canceling Headphones...",
    "price": 348.00,
    "priceRaw": "$348.00",
    "image": "https://m.media-amazon.com/images/I/...",
    ...
  }
}
```

**Indicators**:
- ✅ `result.title` = actual product name (not "Amazon.com")
- ✅ `result.price` = number (not null)
- ✅ `result.image` = valid URL

**Next Step**: Move to **Data Persistence** (Sprint 2)

---

### Scenario B: Still Blocked ❌

**Response looks like**:
```json
{
  "status": "completed",
  "result": {
    "title": "Amazon.com",
    "price": null,
    "image": null
  }
}
```

**OR**:
```json
{
  "status": "failed",
  "error": "Captcha/robot check detected..."
}
```

**Diagnosis**: TLS Fingerprinting detected Python/Twisted
- Headers are correct, but SSL handshake gives it away
- Amazon sees "Python script" not "Chrome browser"

**Next Step**: Implement **Playwright Fallback** (real browser)

---

## What Happens Next

**If Scenario A**: 
- We implement data persistence
- Save products to LocalStorage with price history
- Ready for production

**If Scenario B**:
- We add Playwright to Python service
- Playwright uses real Chromium (authentic TLS)
- Falls back to Playwright when Scrapy fails
- Slower but more reliable

## Testing Environment Note

**Are you testing on**:
- **Local WiFi** (home network)? → Higher chance of Scenario A
- **Cloud server** (AWS/Railway/DigitalOcean)? → Likely Scenario B

This affects which path we take next!


