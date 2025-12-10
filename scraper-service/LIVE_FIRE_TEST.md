# Live Fire Test - Execute Now

## Pre-Flight Checklist

### ✅ Step 1: Install Playwright (Pre-emptive)

**Even if Scrapy works, install Playwright now so fallback is ready:**

```bash
cd scraper-service
pip install playwright
playwright install chromium
```

**Expected Output**:
```
Installing playwright...
Downloading chromium...
Chromium installed successfully
```

**Note**: This downloads ~200MB. Be patient.

### ✅ Step 2: Verify Captcha Detection

The `detect_captcha_trap()` function now checks for:
- ✅ Empty data
- ✅ Generic titles ("Amazon.com", "Amazon.com: Online Shopping", etc.)
- ✅ Missing price (blocked pages rarely have prices)
- ✅ Captcha keywords
- ✅ Site name only with no data

### ✅ Step 3: Start Service

```bash
python app.py
```

**Expected Output**:
```
============================================================
Starting Wist Scraper Service...
Using crochet to manage Scrapy reactor
Service will be available at http://0.0.0.0:5000
============================================================
 * Running on http://0.0.0.0:5000
```

## Execute Test

### Step 1: Open Frontend

1. Go to `http://localhost:3000`
2. Open DevTools → **Network Tab** (optional, for monitoring)
3. **Keep Python terminal visible** (to see logs)

### Step 2: Paste Amazon URL

Use a real Amazon product URL, e.g.:
- `https://www.amazon.com/dp/B08N5WRWNW`
- Or any Amazon product page

### Step 3: Click "Fetch"

**Watch the Python terminal intensely!**

## Expected Terminal Output

### Outcome A: Scrapy Wins ✅

```
Starting scrape job...
✅ Job <id> found item: Sony WH-1000XM5 Wireless Noise...
✅ Job <id>: Scrapy succeeded! Title: 'Sony WH-1000XM5 Wireless Noise...'
```

**Interpretation**: Stealth headers worked! Amazon didn't detect us.

**Next Step**: Move to Data Persistence

---

### Outcome B: Fallback Kicks In 🔄

```
Starting scrape job...
✅ Job <id> found item: Amazon.com
⚠️  Job <id>: Scrapy detected captcha (title: 'Amazon.com'), trying Playwright fallback...
🔄 Job <id>: Starting Playwright fallback...
   [Playwright] Launching browser...
   [Playwright] Extraction complete.
✅ Job <id>: Playwright fallback succeeded! Title: 'Sony WH-1000XM5 Wireless Noise...'
```

**Interpretation**: 
- Scrapy was blocked (TLS fingerprinting detected)
- System automatically tried Playwright
- Playwright succeeded (real browser = authentic TLS)

**Next Step**: 
- If Playwright works → Move to Data Persistence
- If Playwright also fails → Need proxy/API solution

---

### Outcome C: Both Failed ❌

```
Starting scrape job...
✅ Job <id> found item: Amazon.com
⚠️  Job <id>: Scrapy detected captcha, trying Playwright fallback...
🔄 Job <id>: Starting Playwright fallback...
   [Playwright] Launching browser...
   [Playwright] Extraction complete.
❌ Job <id>: Playwright fallback also failed (title: 'Amazon.com')
```

**Interpretation**: 
- Both methods blocked
- IP likely flagged (datacenter IP)
- Need residential proxy or ScraperAPI

**Next Step**: Proxy rotation or structured data extraction

---

## What to Report

**Please report**:
1. **Did you see the "⚠️ trying Playwright fallback" message?**
   - Yes → Scrapy was blocked, fallback triggered
   - No → Scrapy succeeded on first try

2. **Final status**:
   - ✅ Success (got product title and price)
   - ❌ Still blocked (both methods failed)

3. **Which method worked**:
   - Scrapy only
   - Playwright fallback

## Troubleshooting

### "Playwright not installed" Error

**Fix**:
```bash
pip install playwright
playwright install chromium
```

### Playwright Takes Too Long

**Normal**: Playwright is slower (5-15 seconds vs 2-5 seconds)
**Wait**: Give it time, it's using a real browser

### No Logs Appearing

**Check**:
- Python service is running
- Terminal is visible
- Service didn't crash (check for errors)

## Next Steps Based on Result

**If Success (A or B)**:
- ✅ Move to Data Persistence
- ✅ Update LocalStorage to handle price history
- ✅ Test saving products

**If Still Blocked (C)**:
- Need proxy rotation
- OR use structured data extraction (legal, no scraping)
- OR try from different network/IP


