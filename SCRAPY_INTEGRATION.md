# Scrapy Integration for Web Scraping

## Overview

This project now includes Scrapy (Python) as an additional scraping method, particularly effective for sites with strong bot detection like Amazon. Scrapy is integrated alongside the existing Playwright and static scraping methods.

## Architecture

### Components

1. **Python Scraper** (`scraper/scrapy_scraper.py`)
   - Scrapy-based spider for product extraction
   - Handles JSON-LD structured data extraction
   - Domain-specific extractors for Amazon, Best Buy, Target
   - Generic fallback extraction using meta tags

2. **Node.js Wrapper** (`lib/scraper/scrapy-scraper.ts`)
   - Calls Python script as subprocess
   - Normalizes output to match `ScrapeResult` interface
   - Handles errors and timeouts gracefully

3. **Main Scraper Integration** (`lib/scraper/index.ts`)
   - Automatically uses Scrapy for Amazon URLs (if available)
   - Falls back to Playwright if Scrapy fails or unavailable
   - Maintains existing fallback chain

## Installation

### Local Development

```bash
# Install Python dependencies
pip install -r requirements.txt
```

### Docker

The Dockerfile automatically installs Python 3 and Scrapy during the build process.

## Usage

Scrapy is automatically used for Amazon URLs when:
1. Python 3 is available
2. Scrapy is installed
3. The URL domain contains "amazon"

The scraper will fall back to Playwright if Scrapy fails or is unavailable.

## Scrapy Features

### Anti-Bot Detection

- Realistic browser headers
- Download delays (1-3 seconds)
- Randomized delays
- Proper User-Agent strings
- Respects rate limits

### Extraction Methods

1. **JSON-LD Structured Data** (Primary)
   - Extracts from `<script type="application/ld+json">`
   - Most reliable and legal method
   - Works even when page rendering is blocked

2. **Domain-Specific Extractors**
   - Amazon: Custom selectors for product title, price, image
   - Best Buy: Site-specific extraction
   - Target: Site-specific extraction

3. **Generic Meta Tags** (Fallback)
   - Open Graph tags
   - Standard meta tags
   - Title tag extraction

## Configuration

Scrapy settings can be modified in `scraper/scrapy_scraper.py`:

```python
settings.set('DOWNLOAD_DELAY', 1)  # Delay between requests
settings.set('AUTOTHROTTLE_ENABLED', True)  # Automatic throttling
settings.set('CONCURRENT_REQUESTS', 1)  # Sequential requests
```

## Testing

Test the Python scraper directly:

```bash
python scraper/scrapy_scraper.py "https://www.amazon.com/dp/PRODUCT_ID"
```

## Troubleshooting

### Python Not Found

If you see "Python 3 not found":
- Ensure Python 3 is installed and in PATH
- On Windows, the script uses `python` instead of `python3`

### Scrapy Not Installed

If Scrapy is not available:
- Run `pip install -r requirements.txt`
- The scraper will automatically fall back to Playwright

### Empty Results

If Scrapy returns empty results:
- The site may have strong bot detection
- The scraper will automatically fall back to Playwright
- Check the console logs for error messages

## Dependencies

See `requirements.txt` for full Python dependencies:
- scrapy>=2.11.0
- scrapy-user-agents>=0.1.1
- scrapy-rotating-proxies>=0.6.2
- fake-useragent>=1.4.0
- beautifulsoup4>=4.12.0
- lxml>=4.9.0

## Future Enhancements

- Add more domain-specific extractors
- Implement rotating proxies
- Add caching for Scrapy results
- Support for more e-commerce sites









