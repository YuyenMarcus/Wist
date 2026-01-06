# Scenario B Setup - Playwright Fallback

## If You Got "Still Blocked" Result

This means Amazon detected TLS fingerprinting. We need Playwright (real browser) fallback.

## Quick Setup

### Step 1: Install Playwright

```bash
cd scraper-service
pip install playwright
playwright install chromium
```

**Note**: This downloads Chromium (~200MB). Be patient.

### Step 2: Restart Service

```bash
python app.py
```

### Step 3: Test Again

1. Paste Amazon URL in frontend
2. Click "Fetch"
3. **Wait longer** (Playwright is slower: 5-15 seconds)

### Step 4: Check Result

You should now see:
- ✅ Product title and price (Playwright succeeded!)
- OR still blocked (need proxy/API solution)

## What Changed

**Automatic Fallback**:
1. Scrapy tries first (fast)
2. If fails or detects captcha → Playwright tries (real browser)
3. Returns whichever succeeds

**Console Output**:
```
⚠️  Job <id>: Scrapy detected captcha, trying Playwright fallback...
🔄 Job <id>: Starting Playwright fallback...
✅ Job <id>: Playwright fallback succeeded!
```

## Expected Behavior

- **First request**: Scrapy tries → Fails → Playwright succeeds
- **Subsequent requests**: Same pattern
- **Slower**: 5-15 seconds total (vs 2-5 seconds with Scrapy only)

## If Still Blocked After Playwright

**Possible causes**:
1. **IP flagged**: Datacenter IP is blacklisted
2. **Rate limiting**: Too many requests
3. **Advanced detection**: Beyond TLS fingerprinting

**Solutions**:
1. Use residential proxy
2. Use ScraperAPI service
3. Try from different network/IP
4. Use structured data extraction first (before any scraping)

## Next Steps

**If Playwright works**:
- ✅ Move to Data Persistence
- ✅ Save products with price history
- ✅ Ready for production

**If still blocked**:
- Need proxy rotation
- OR use structured data extraction (legal, no scraping)









