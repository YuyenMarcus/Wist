# Stealth Tuning Guide - Anti-Bot Detection

## Problem

If you got **Option B (Captcha Trap)**, Amazon is detecting the scraper. We need to enhance anti-bot measures.

## Current Settings

**File**: `scraper-service/app.py` → `get_scrapy_settings()`

Current configuration:
- Single User-Agent
- Basic delays (1-3 seconds)
- Standard headers

## Enhancement Options

### Option 1: User-Agent Rotation

**Install**: `scrapy-user-agents` (already in requirements.txt)

**Update `get_scrapy_settings()`**:
```python
def get_scrapy_settings():
    settings = Settings()
    
    # Enable user agent rotation
    settings.set('DOWNLOADER_MIDDLEWARES', {
        'scrapy.downloadermiddlewares.useragent.UserAgentMiddleware': None,
        'scrapy_user_agents.middlewares.RandomUserAgentMiddleware': 400,
    })
    
    # ... rest of settings
```

### Option 2: Enhanced Headers

**Update spider headers** in `spiders/product_spider.py`:
```python
headers={
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
    'Accept-Encoding': 'gzip, deflate, br',
    'Connection': 'keep-alive',
    'Upgrade-Insecure-Requests': '1',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'none',
    'Sec-Fetch-User': '?1',  # NEW: Indicates user-initiated request
    'Cache-Control': 'max-age=0',
    'DNT': '1',  # NEW: Do Not Track
    'Referer': 'https://www.google.com/',  # NEW: Fake referer
}
```

### Option 3: Increased Delays

```python
settings.set('DOWNLOAD_DELAY', 3)  # Increase from 1 to 3 seconds
settings.set('RANDOMIZE_DOWNLOAD_DELAY', 1.0)  # More randomization
settings.set('AUTOTHROTTLE_START_DELAY', 2)  # Start with 2s delay
settings.set('AUTOTHROTTLE_MAX_DELAY', 10)  # Max 10s delay
```

### Option 4: Proxy Rotation (Advanced)

**Install**: `scrapy-rotating-proxies` (already in requirements.txt)

**Add to settings**:
```python
settings.set('ROTATING_PROXY_LIST_PATH', '/path/to/proxies.txt')
settings.set('DOWNLOADER_MIDDLEWARES', {
    'rotating_proxies.middlewares.RotatingProxyMiddleware': 610,
    'rotating_proxies.middlewares.BanDetectionMiddleware': 620,
})
```

### Option 5: Cookie Handling

```python
settings.set('COOKIES_ENABLED', True)
settings.set('COOKIES_DEBUG', False)
```

## Recommended Implementation

**Start with Options 1 + 2 + 3** (easiest, no external dependencies):

1. Enable user-agent rotation
2. Add enhanced headers (Sec-Fetch-User, Referer, DNT)
3. Increase delays to 3-10 seconds

**If still blocked**, add Option 4 (proxy rotation) - requires proxy list.

## Testing After Changes

1. Restart Python service
2. Run smoke test again
3. Check if you get Option A (Success) or still Option B (Captcha)

## Alternative: Use Structured Data First

**Best approach**: Try structured data extraction BEFORE Scrapy:

1. Fast HTTP request (no browser)
2. Extract JSON-LD (legal, no bot detection)
3. Only use Scrapy if structured data fails

This is already implemented in the main scraper - ensure it's being used!

## Next Steps

1. Implement recommended enhancements
2. Test with Amazon URL
3. If still blocked, consider:
   - Residential proxies
   - Browser automation (Playwright) instead of Scrapy
   - API alternatives (Amazon Product Advertising API)


