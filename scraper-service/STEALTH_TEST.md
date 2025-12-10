# Stealth Mode Test - Round 2

## What Changed

✅ **Created `settings.py`** with full stealth configuration:
- User-Agent rotation enabled
- Realistic Chrome headers
- Google referer (pretend we came from search)
- Human-like delays (2-10 seconds)
- Cookies disabled

✅ **Updated `app.py`** to use `get_project_settings()`:
- Loads settings from `settings.py` automatically
- Ensures user-agent rotation middleware is active

✅ **Updated spider** to use stealth headers:
- Removed hardcoded User-Agent (now rotated)
- Added Google referer
- Headers merge with `DEFAULT_REQUEST_HEADERS` from settings

## Execute Stealth Test

### Step 1: Restart Python Service

**IMPORTANT**: Must restart to load new settings!

```bash
cd scraper-service
# Press CTRL+C to stop
python app.py
```

**Verify you see**:
```
============================================================
Starting Wist Scraper Service...
Using crochet to manage Scrapy reactor
Service will be available at http://0.0.0.0:5000
============================================================
 * Running on http://0.0.0.0:5000
```

### Step 2: Test in Browser

1. Open `http://localhost:3000`
2. Open DevTools → **Network Tab**
3. Paste Amazon URL (same one as before)
4. Click "Fetch"
5. **Wait longer** - delays are now 2-10 seconds (human speed)

### Step 3: Check Python Console

You should see:
```
✅ Job <job_id> found item: <PRODUCT_NAME>...
```

**If you see "Amazon.com" again**, Amazon is still detecting us.

### Step 4: Check Network Response

Find the final `GET /api/job-status/<job_id>` response.

## Expected Results

### ✅ Success (Stealth Works!)

```json
{
  "status": "completed",
  "result": {
    "title": "Sony WH-1000XM5 Wireless Noise Canceling Headphones...",
    "price": 348.00,
    "priceRaw": "$348.00",
    "currency": "USD",
    "image": "https://m.media-amazon.com/images/I/...",
    "description": "...",
    "url": "https://www.amazon.com/dp/..."
  }
}
```

**Indicators**:
- ✅ `result.title` contains actual product name (not "Amazon.com")
- ✅ `result.price` is a number (not null)
- ✅ `result.image` is a valid URL

**Next Step**: Proceed to **Data Persistence** (Sprint 2) 🎉

---

### ❌ Still Blocked (Amazon Detected Us)

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

**Possible Causes**:
1. **Datacenter IP**: If testing on AWS/DigitalOcean, IP is flagged
2. **Rate Limiting**: Too many requests from same IP
3. **Advanced Detection**: Amazon using fingerprinting beyond headers

**Next Steps** (Nuclear Option):
1. **Proxy Rotation**: Use residential proxies
2. **ScraperAPI**: Use proxy service (paid)
3. **Playwright**: Full browser automation (already in codebase)
4. **Structured Data First**: Try JSON-LD extraction before Scrapy

---

## Verification Checklist

- [ ] Python service restarted (CTRL+C then restart)
- [ ] `settings.py` file exists in `scraper-service/` directory
- [ ] Service shows "Running on http://0.0.0.0:5000"
- [ ] Pasted Amazon URL in frontend
- [ ] Waited 5-10 seconds (longer delays now)
- [ ] Checked Python console for "✅ Job found item"
- [ ] Checked final response in Network tab

## Troubleshooting

### Settings Not Loading

**Check**:
- `settings.py` exists in `scraper-service/` directory
- `scrapy.cfg` exists (tells Scrapy where settings are)
- Python service was restarted after creating files

**Verify**:
```python
# In Python console (or add to app.py temporarily)
from scrapy.utils.project import get_project_settings
settings = get_project_settings()
print(settings.get('DOWNLOADER_MIDDLEWARES'))
# Should show RandomUserAgentMiddleware
```

### Still Getting "Amazon.com"

**If on local WiFi**:
- Try different Amazon product URL
- Wait longer between requests (increase `DOWNLOAD_DELAY` to 5)
- Check if IP is flagged (try from different network)

**If on cloud server**:
- IP is likely flagged as datacenter
- Need residential proxy or ScraperAPI
- OR use Playwright (full browser) instead

## Report Your Result

Please report:
- **Success**: Got product title and price → Move to persistence
- **Still Blocked**: Still seeing "Amazon.com" → Need proxy/API solution


