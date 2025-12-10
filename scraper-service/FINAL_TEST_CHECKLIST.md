# Final Test Checklist - Ready to Execute

## ✅ Pre-Flight Complete

### 1. Enhanced Captcha Detection ✅
- Detects generic titles ("Amazon.com", "Amazon.com: Online Shopping", etc.)
- Checks for missing price
- Handles soft blocks (200 OK but generic content)

### 2. Robust Playwright Scraper ✅
- Stealth browser args (`--disable-blink-features=AutomationControlled`)
- Navigator.webdriver override (critical for avoiding detection)
- JSON-LD extraction first (most reliable)
- CSS selector fallbacks
- Cookie banner handling
- Human-like delays (2-5 seconds random)

### 3. Automatic Fallback Logic ✅
- Scrapy tries first
- If captcha detected → Playwright automatically tries
- Clear logging at each step
- No user intervention needed

## Execute Test - Step by Step

### Step 1: Install Playwright (CRITICAL!)

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

**⚠️ IMPORTANT**: The `playwright install chromium` step downloads ~200MB. Be patient!

### Step 2: Verify Installation

```bash
python -c "from playwright.sync_api import sync_playwright; print('✅ Playwright ready')"
```

Should print: `✅ Playwright ready`

### Step 3: Start Service

```bash
python app.py
```

**Keep terminal visible!** You need to see the logs.

**Expected Output**:
```
============================================================
Starting Wist Scraper Service...
Using crochet to manage Scrapy reactor
Service will be available at http://0.0.0.0:5000
============================================================
 * Running on http://0.0.0.0:5000
```

### Step 4: Run Test

1. Open `http://localhost:3000` in browser
2. Open DevTools → Network Tab (optional, for monitoring)
3. Paste Amazon URL (e.g., `https://www.amazon.com/dp/B08N5WRWNW`)
4. Click "Fetch"
5. **Watch Python terminal intensely!**

## Expected Terminal Output

### Outcome A: Scrapy Wins ✅

```
✅ Job <id> found item: Sony WH-1000XM5 Wireless Noise...
✅ Job <id>: Scrapy succeeded! Title: 'Sony WH-1000XM5 Wireless Noise...'
```

**Interpretation**: Stealth headers worked! No fallback needed.

**Next**: Move to Data Persistence

---

### Outcome B: Fallback Triggers (Self-Healing) 🔄

```
✅ Job <id> found item: Amazon.com
⚠️  Job <id>: Scrapy detected captcha (title: 'Amazon.com'), trying Playwright fallback...
🔄 Job <id>: Starting Playwright fallback...
[Playwright] Launching browser for https://www.amazon.com/dp/...
   [Playwright] Navigating to URL...
   [Playwright] Waiting 3.2s (human behavior)...
   [Playwright] Extracting product data...
   [Playwright] Extraction complete. Title: 'Sony WH-1000XM5 Wireless Noise...'
✅ Job <id>: Playwright fallback succeeded! Title: Sony WH-1000XM5 Wireless Noise...
```

**Interpretation**: 
- Scrapy was blocked (TLS fingerprinting)
- System automatically tried Playwright
- Playwright succeeded (real browser = authentic TLS)
- **System healed itself!**

**Next**: Move to Data Persistence

---

### Outcome C: Both Failed ❌

```
✅ Job <id> found item: Amazon.com
⚠️  Job <id>: Scrapy detected captcha, trying Playwright fallback...
🔄 Job <id>: Starting Playwright fallback...
[Playwright] Launching browser for https://www.amazon.com/dp/...
   [Playwright] Navigating to URL...
   [Playwright] Waiting 2.8s (human behavior)...
   [Playwright] Extracting product data...
   [Playwright] Extraction failed - no title found
❌ Job <id>: Playwright also failed (title: 'None')
```

**Interpretation**: 
- Both methods blocked
- IP likely flagged (datacenter IP)
- Need residential proxy or ScraperAPI

**Next**: Proxy rotation or structured data extraction

---

## What to Report

**Please report**:

1. **Did you see "⚠️ trying Playwright fallback"?**
   - [ ] Yes → Scrapy was blocked, fallback triggered
   - [ ] No → Scrapy succeeded on first try

2. **Final result**:
   - [ ] Success (got product title and price)
   - [ ] Still blocked (both methods failed)

3. **Which method worked**:
   - [ ] Scrapy only
   - [ ] Playwright fallback
   - [ ] Neither

4. **Testing environment**:
   - [ ] Local WiFi (home network)
   - [ ] Cloud server (AWS/Railway/etc.)

## Troubleshooting

### "ModuleNotFoundError: No module named 'playwright'"

**Fix**:
```bash
pip install playwright
```

### "Executable doesn't exist" or Chromium not found

**Fix**:
```bash
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

## Ready to Execute!

Everything is prepared. The system is "self-healing" - if Scrapy fails, Playwright automatically tries.

**Install Playwright → Start Service → Run Test → Report Results**


