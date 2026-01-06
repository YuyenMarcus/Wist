# Playwright Fallback Plan (Scenario B)

## Problem

Amazon detects TLS fingerprinting - Python/Twisted SSL handshake looks different than Chrome, even with perfect headers.

## Solution

Add Playwright (real browser) as fallback when Scrapy fails.

## Architecture

```
Request comes in
    ↓
Try Scrapy first (fast, lightweight)
    ↓
If fails or returns "Amazon.com" → Detect captcha
    ↓
Fallback to Playwright (real browser, authentic TLS)
    ↓
Return result
```

## Implementation Steps

### Step 1: Install Playwright in Python Service

**Update `requirements.txt`**:
```txt
playwright>=1.40.0
```

**Install**:
```bash
pip install playwright
playwright install chromium
```

### Step 2: Create Playwright Scraper

**New file**: `scraper-service/playwright_scraper.py`

```python
from playwright.sync_api import sync_playwright
import time

def scrape_with_playwright(url):
    """Scrape using real browser (authentic TLS fingerprint)"""
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        
        # Set realistic viewport
        page.set_viewport_size({"width": 1920, "height": 1080})
        
        # Navigate with realistic headers
        page.goto(url, wait_until="networkidle")
        
        # Wait a bit (human behavior)
        time.sleep(2)
        
        # Extract data (same selectors as Scrapy)
        # ... extraction logic ...
        
        browser.close()
        return result
```

### Step 3: Update `app.py` to Use Fallback

**In `run_spider()` function**:
```python
def on_success(result):
    item_data = SCRAPED_ITEMS.get(job_id)
    
    if item_data and not detect_captcha_trap(item_data):
        # Success!
        JOBS[job_id]["status"] = STATUS_COMPLETED
        JOBS[job_id]["data"] = item_data
    else:
        # Scrapy failed or detected captcha → Try Playwright
        try:
            from playwright_scraper import scrape_with_playwright
            playwright_result = scrape_with_playwright(url)
            if playwright_result and not detect_captcha_trap(playwright_result):
                JOBS[job_id]["status"] = STATUS_COMPLETED
                JOBS[job_id]["data"] = playwright_result
            else:
                JOBS[job_id]["status"] = STATUS_FAILED
                JOBS[job_id]["error"] = "Both Scrapy and Playwright failed"
        except Exception as e:
            JOBS[job_id]["status"] = STATUS_FAILED
            JOBS[job_id]["error"] = f"Playwright fallback failed: {str(e)}"
```

## Benefits

✅ **Authentic TLS**: Real Chromium = real browser fingerprint
✅ **JavaScript Support**: Can handle dynamic content
✅ **Stealth**: Harder to detect than Python requests
✅ **Fallback Only**: Only used when Scrapy fails (keeps it fast)

## Trade-offs

❌ **Slower**: 5-15 seconds vs 2-5 seconds
❌ **Heavier**: Requires Chromium binary (~200MB)
❌ **More Resources**: Uses more memory/CPU

## When to Use

- Scenario B: Scrapy consistently blocked
- Cloud IP: Datacenter IP flagged
- Advanced Sites: Sites with heavy JavaScript

## Next Steps (If Scenario B)

1. Install Playwright in Python service
2. Create `playwright_scraper.py`
3. Update `app.py` with fallback logic
4. Test again
5. Should see success with Playwright









