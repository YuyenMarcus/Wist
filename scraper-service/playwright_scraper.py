"""
Enhanced Playwright-based scraper for product extraction
Supports: Amazon, Etsy, and independent/generic websites
Uses stealth settings to avoid bot detection
"""
from playwright.sync_api import sync_playwright, TimeoutError as PlaywrightTimeout
import time
import random
import json
import re
import os
from urllib.parse import urlparse

# Import stealth plugin
try:
    from playwright_stealth import stealth_sync
    STEALTH_AVAILABLE = True
except ImportError:
    STEALTH_AVAILABLE = False
    print("[Playwright] Warning: playwright-stealth not installed")

# User agents for rotation
USER_AGENTS = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
]


def get_random_user_agent():
    return random.choice(USER_AGENTS)


def extract_from_blocked_page(page, url, source):
    """
    Try to extract minimal data from a blocked page using OG meta tags.
    Even challenge pages sometimes include basic metadata.
    """
    print(f"   [Playwright] Attempting extraction from blocked {source} page...")
    
    result = {
        "title": None,
        "price": None,
        "priceRaw": None,
        "image": None,
        "description": None,
        "url": url,
        "method": f"playwright_{source}_blocked"
    }
    
    try:
        # Try OG tags
        og_title = page.query_selector('meta[property="og:title"]')
        if og_title:
            result['title'] = og_title.get_attribute('content')
            print(f"   [Playwright] Found OG title: {result['title'][:50] if result['title'] else 'None'}...")
        
        og_image = page.query_selector('meta[property="og:image"]')
        if og_image:
            result['image'] = og_image.get_attribute('content')
            print(f"   [Playwright] Found OG image")
        
        og_desc = page.query_selector('meta[property="og:description"]')
        if og_desc:
            result['description'] = og_desc.get_attribute('content')
        
        # Try to find price in any meta tag
        price_meta = page.query_selector('meta[property="product:price:amount"]')
        if price_meta:
            price_val = price_meta.get_attribute('content')
            if price_val:
                result['price'] = float(price_val)
                result['priceRaw'] = f"${result['price']:.2f}"
                print(f"   [Playwright] Found OG price: {result['priceRaw']}")
    except Exception as e:
        print(f"   [Playwright] Error extracting from blocked page: {e}")
    
    return result


def scrape_with_playwright(url):
    """
    Main entry point for Playwright scraping.
    Detects site type and uses appropriate extraction strategy.
    """
    print(f"[Playwright] Scraping: {url}")
    
    domain = urlparse(url).netloc.lower()
    
    with sync_playwright() as p:
        # ALWAYS use headless mode on server (no display available)
        browser = p.chromium.launch(
            headless=True,
            args=[
                '--disable-blink-features=AutomationControlled',
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-infobars',
                '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas',
                '--no-first-run',
                '--no-zygote',
                '--disable-gpu',
                '--single-process',
            ]
        )
        
        # Create context with realistic settings
        context = browser.new_context(
            viewport={'width': 1920, 'height': 1080},
            user_agent=get_random_user_agent(),
            locale='en-US',
            timezone_id='America/New_York',
            permissions=['geolocation'],
        )
        
        # Hide webdriver property
        context.add_init_script("""
            Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
            Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });
            Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
        """)
        
        page = context.new_page()
        
        # Apply stealth if available
        if STEALTH_AVAILABLE:
            stealth_sync(page)
            print("   [Playwright] Stealth mode activated")
        
        try:
            # Navigate with retry logic
            for attempt in range(3):
                try:
                    page.goto(url, timeout=45000, wait_until='domcontentloaded')
                    break
                except PlaywrightTimeout:
                    if attempt == 2:
                        raise
                    print(f"   [Playwright] Timeout, retrying... ({attempt + 1}/3)")
                    time.sleep(2)
            
            # Wait for page to settle
            page.wait_for_timeout(2000 + random.randint(0, 1000))
            
            # Human-like behavior
            page.mouse.move(random.randint(100, 300), random.randint(100, 300))
            
            # Check for blocks/captchas
            page_title = page.title().lower()
            blocked_indicators = ['robot', 'captcha', 'verify', 'security check', 'access denied', 'unusual traffic']
            
            if any(indicator in page_title for indicator in blocked_indicators):
                print(f"   [Playwright] Blocked detected: {page_title}")
                # Wait and retry once
                page.wait_for_timeout(5000)
                page_title = page.title().lower()
                if any(indicator in page_title for indicator in blocked_indicators):
                    browser.close()
                    return None
            
            # Route to appropriate extractor
            if 'amazon' in domain:
                result = extract_amazon(page, url)
            elif 'etsy' in domain:
                # Etsy often needs more time to load JavaScript
                print("   [Playwright] Etsy detected - waiting for network idle...")
                try:
                    page.wait_for_load_state('networkidle', timeout=15000)
                except:
                    print("   [Playwright] Network idle timeout, continuing anyway...")
                
                # Also wait a bit more for JS to render
                page.wait_for_timeout(3000)
                
                # Log page HTML length for debugging
                html = page.content()
                print(f"   [Playwright] Page HTML length: {len(html)} chars")
                
                if len(html) < 5000:
                    print(f"   [Playwright] WARNING: Page seems blocked, trying OG tags from blocked page...")
                    # Even blocked pages sometimes have OG tags - try to extract them
                    result = extract_from_blocked_page(page, url, 'etsy')
                else:
                    result = extract_etsy(page, url)
            elif any(store in domain for store in ['bestbuy', 'target', 'walmart']):
                result = extract_major_retailer(page, url, domain)
            else:
                result = extract_generic(page, url)
            
            browser.close()
            return result
            
        except Exception as e:
            import traceback
            print(f"[Playwright] Error: {e}")
            print(f"[Playwright] Traceback: {traceback.format_exc()}")
            browser.close()
            return None


def extract_amazon(page, url):
    """
    Amazon-specific extraction with multiple fallback selectors.
    Handles different Amazon page layouts.
    """
    print("   [Playwright] Using Amazon extractor")
    
    result = {
        "title": None,
        "price": None,
        "priceRaw": None,
        "image": None,
        "description": None,
        "url": url,
        "method": "playwright_amazon"
    }
    
    # Wait for key elements
    try:
        page.wait_for_selector('#productTitle, #title, .product-title-word-break', timeout=10000)
    except:
        pass
    
    # === TITLE ===
    title_selectors = [
        '#productTitle',
        '#title span',
        'h1.product-title-word-break',
        'h1 span#productTitle',
    ]
    for sel in title_selectors:
        try:
            el = page.query_selector(sel)
            if el:
                text = el.inner_text().strip()
                if text and len(text) > 5:
                    result['title'] = text
                    break
        except:
            continue
    
    # === PRICE ===
    # Amazon has many price formats - prioritize "price to pay" (actual current price)
    # IMPORTANT: Order matters - most reliable first, avoid "was" prices
    price_selectors = [
        # Actual price to pay (most accurate)
        '.priceToPay span.a-offscreen',
        '#corePrice_desktop .priceToPay span.a-offscreen',
        # Deal/sale prices
        '#priceblock_dealprice',
        '#priceblock_saleprice', 
        '#priceblock_ourprice',
        # Desktop price display (avoid "was" prices)
        '#corePriceDisplay_desktop_feature_div .priceToPay span.a-offscreen',
        '#corePrice_feature_div .a-price span.a-offscreen',
        '#apex_desktop .priceToPay span.a-offscreen',
        # Kindle/Digital
        '#kindle-price',
        '#price_inside_buybox',
        # Fallback - combined whole + fraction
        '#corePriceDisplay_desktop_feature_div .a-price-whole',
    ]
    
    for sel in price_selectors:
        try:
            el = page.query_selector(sel)
            if el:
                price_text = el.inner_text().strip()
                
                # If we got a-price-whole, we need to also get the fraction
                if 'a-price-whole' in sel:
                    fraction_el = page.query_selector('#corePriceDisplay_desktop_feature_div .a-price-fraction')
                    if fraction_el:
                        fraction = fraction_el.inner_text().strip()
                        price_text = f"{price_text}.{fraction}"
                
                # Clean and extract price
                price_match = re.search(r'[\$]?([\d,]+\.?\d*)', price_text)
                if price_match:
                    price_str = price_match.group(1).replace(',', '')
                    price_val = float(price_str)
                    if price_val > 0:  # Make sure it's a valid price
                        result['price'] = price_val
                        result['priceRaw'] = f"${result['price']:.2f}"
                        print(f"   💵 Found price via '{sel}': ${result['price']:.2f}")
                        break
        except Exception as e:
            print(f"   ⚠️ Price selector '{sel}' failed: {e}")
            continue
    
    # === IMAGE ===
    image_selectors = [
        '#landingImage',
        '#imgBlkFront',
        '#ebooksImgBlkFront',
        '#main-image',
        '.a-dynamic-image',
        '#imageBlock img',
    ]
    
    for sel in image_selectors:
        try:
            el = page.query_selector(sel)
            if el:
                # Try different attributes
                for attr in ['src', 'data-old-hires', 'data-a-dynamic-image']:
                    img = el.get_attribute(attr)
                    if img and img.startswith('http'):
                        # For data-a-dynamic-image, extract first URL
                        if attr == 'data-a-dynamic-image':
                            try:
                                img_data = json.loads(img)
                                img = list(img_data.keys())[0] if img_data else None
                            except:
                                continue
                        if img:
                            result['image'] = img
                            break
                if result['image']:
                    break
        except:
            continue
    
    # === DESCRIPTION ===
    try:
        desc_el = page.query_selector('#productDescription p, #feature-bullets')
        if desc_el:
            result['description'] = desc_el.inner_text().strip()[:500]
    except:
        pass
    
    return result


def extract_etsy(page, url):
    """
    Etsy-specific extraction with security check handling.
    """
    print("   [Playwright] Using Etsy extractor")
    
    result = {
        "title": None,
        "price": None,
        "priceRaw": None,
        "image": None,
        "description": None,
        "url": url,
        "method": "playwright_etsy"
    }
    
    # Log current page state
    try:
        page_title = page.title()
        print(f"   [Playwright] Page title: {page_title}")
        page_url = page.url
        print(f"   [Playwright] Current URL: {page_url}")
        
        # Check if page looks blocked
        body_preview = page.inner_text('body')[:200] if page.query_selector('body') else ''
        print(f"   [Playwright] Body preview: {body_preview[:100]}...")
    except Exception as e:
        print(f"   [Playwright] Could not get page info: {e}")
    
    # Handle Etsy security check
    try:
        security_check = page.query_selector('text="Please verify you are a human"')
        if security_check:
            print("   [Playwright] Etsy security check detected, waiting...")
            page.wait_for_timeout(8000)
        
        # Also check for other blocking indicators
        body_text = page.inner_text('body')[:500] if page.query_selector('body') else ''
        if 'please verify' in body_text.lower() or 'security check' in body_text.lower():
            print("   [Playwright] Detected security verification in body text")
            page.wait_for_timeout(10000)
    except Exception as e:
        print(f"   [Playwright] Security check error: {e}")
    
    # Try JSON-LD first (most reliable for Etsy)
    try:
        scripts = page.query_selector_all('script[type="application/ld+json"]')
        if scripts:
            for script in scripts:
                try:
                    content = script.inner_text()
                    if not content:
                        continue
                    data = json.loads(content)
                    
                    # Handle array format
                    if isinstance(data, list):
                        for item in data:
                            if isinstance(item, dict) and item.get('@type') in ['Product', 'IndividualProduct']:
                                data = item
                                break
                    
                    if isinstance(data, dict) and data.get('@type') in ['Product', 'IndividualProduct']:
                        result['title'] = data.get('name')
                        desc = data.get('description')
                        result['description'] = str(desc)[:500] if desc else ''
                        
                        # Image
                        img = data.get('image')
                        if isinstance(img, list) and len(img) > 0:
                            img = img[0]
                        if isinstance(img, dict):
                            img = img.get('url') or img.get('contentUrl')
                        result['image'] = str(img) if img else None
                        
                        # Price
                        offers = data.get('offers')
                        if isinstance(offers, list) and len(offers) > 0:
                            offers = offers[0]
                        if isinstance(offers, dict):
                            price_val = offers.get('price') or offers.get('lowPrice')
                            if price_val:
                                result['price'] = float(price_val)
                                result['priceRaw'] = f"${result['price']:.2f}"
                        break
                except Exception as e:
                    print(f"   [Playwright] JSON-LD parse error: {e}")
                    continue
    except Exception as e:
        print(f"   [Playwright] JSON-LD extraction error: {e}")
    
    # CSS fallback if JSON-LD failed
    if not result['title']:
        print("   [Playwright] Trying CSS selectors for title...")
        title_selectors = [
            'h1[data-buy-box-listing-title]',
            'h1.listing-page-title',
            'h1.wt-text-body-01',
            'h1[data-listing-page-title]',
            '[data-testid="listing-title"]',
            'h1',  # Last resort - any h1
        ]
        for sel in title_selectors:
            try:
                el = page.query_selector(sel)
                if el:
                    text = el.inner_text().strip()
                    if text and len(text) > 3:
                        result['title'] = text
                        print(f"   [Playwright] Found title via '{sel}': {text[:50]}...")
                        break
            except Exception as e:
                print(f"   [Playwright] Title selector '{sel}' failed: {e}")
                continue
    
    if not result['price']:
        print("   [Playwright] Trying CSS selectors for price...")
        price_selectors = [
            'p.wt-text-title-03 .currency-value',
            '[data-buy-box-region="price"] .currency-value',
            '.wt-text-title-larger',
            '[data-testid="listing-price"]',
            '.wt-text-title-01',
            '[data-selector="price"]',
        ]
        for sel in price_selectors:
            try:
                el = page.query_selector(sel)
                if el:
                    price_text = el.inner_text().strip()
                    price_match = re.search(r'([\d,]+\.?\d*)', price_text)
                    if price_match:
                        result['price'] = float(price_match.group(1).replace(',', ''))
                        result['priceRaw'] = f"${result['price']:.2f}"
                        print(f"   [Playwright] Found price via '{sel}': ${result['price']}")
                        break
            except:
                continue
    
    if not result['image']:
        print("   [Playwright] Trying to find image...")
        # Try og:image first
        try:
            og = page.query_selector('meta[property="og:image"]')
            if og:
                result['image'] = og.get_attribute('content')
                if result['image']:
                    print(f"   [Playwright] Found image via og:image")
        except:
            pass
        
        # Fallback to page images
        if not result['image']:
            try:
                img = page.query_selector('img[src*="etsystatic.com"][src*="/il/"]')
                if img:
                    result['image'] = img.get_attribute('src')
                    print(f"   [Playwright] Found image via Etsy image selector")
            except:
                pass
    
    print(f"   [Playwright] Etsy extraction result: title={bool(result['title'])}, price={result['price']}, image={bool(result['image'])}")
    return result


def extract_major_retailer(page, url, domain):
    """
    Extraction for major retailers: Best Buy, Target, Walmart
    """
    print(f"   [Playwright] Using major retailer extractor for {domain}")
    
    result = {
        "title": None,
        "price": None,
        "priceRaw": None,
        "image": None,
        "description": None,
        "url": url,
        "method": f"playwright_{domain.split('.')[0]}"
    }
    
    # Site-specific selectors
    if 'bestbuy' in domain:
        selectors = {
            'title': ['h1.heading-5', '[data-testid="product-title"]', 'h1'],
            'price': ['.priceView-customer-price span', '[data-testid="price"]', '.pricing-price'],
            'image': ['[data-testid="product-image"] img', '.product-image img', 'img.primary-image'],
        }
    elif 'target' in domain:
        selectors = {
            'title': ['h1[data-test="product-title"]', 'h1'],
            'price': ['[data-test="product-price"]', '.pricing-current-price'],
            'image': ['[data-test="product-image"] img', '.carousel-image img'],
        }
    elif 'walmart' in domain:
        selectors = {
            'title': ['h1.prod-ProductTitle', '[data-testid="product-title"]', 'h1'],
            'price': ['[itemprop="price"]', '[data-testid="price"]', '.price-characteristic'],
            'image': ['[data-testid="product-image"] img', '.prod-hero-image img'],
        }
    else:
        return extract_generic(page, url)
    
    # Extract using selectors
    for sel in selectors.get('title', []):
        try:
            el = page.query_selector(sel)
            if el:
                result['title'] = el.inner_text().strip()
                break
        except:
            continue
    
    for sel in selectors.get('price', []):
        try:
            el = page.query_selector(sel)
            if el:
                price_text = el.inner_text().strip()
                price_match = re.search(r'[\$]?([\d,]+\.?\d*)', price_text)
                if price_match:
                    result['price'] = float(price_match.group(1).replace(',', ''))
                    result['priceRaw'] = f"${result['price']:.2f}"
                    break
        except:
            continue
    
    for sel in selectors.get('image', []):
        try:
            el = page.query_selector(sel)
            if el:
                result['image'] = el.get_attribute('src')
                if result['image']:
                    break
        except:
            continue
    
    return result


def extract_generic(page, url):
    """
    Generic extraction for independent/unknown websites.
    Uses JSON-LD → OpenGraph → CSS heuristics
    """
    print("   [Playwright] Using generic extractor")
    
    result = {
        "title": None,
        "price": None,
        "priceRaw": None,
        "image": None,
        "description": None,
        "url": url,
        "method": "playwright_generic"
    }
    
    # === STRATEGY 1: JSON-LD (Most reliable) ===
    try:
        scripts = page.query_selector_all('script[type="application/ld+json"]')
        for script in scripts:
            try:
                content = script.inner_text()
                data = json.loads(content)
                
                # Handle arrays
                items = data if isinstance(data, list) else [data]
                
                for item in items:
                    if isinstance(item, dict) and item.get('@type') in ['Product', 'Offer', 'IndividualProduct']:
                        if not result['title']:
                            result['title'] = item.get('name')
                        if not result['description']:
                            desc = item.get('description') or ''
                            result['description'] = desc[:500] if desc else ''
                        
                        # Image
                        if not result['image']:
                            img = item.get('image')
                            if isinstance(img, list) and len(img) > 0:
                                img = img[0]
                            if isinstance(img, dict):
                                img = img.get('url') or img.get('contentUrl')
                            result['image'] = img if img else None
                        
                        # Price
                        if not result['price']:
                            offers = item.get('offers') or item
                            if isinstance(offers, list) and len(offers) > 0:
                                offers = offers[0]
                            if isinstance(offers, dict):
                                price_val = offers.get('price') or offers.get('lowPrice')
                                if price_val:
                                    result['price'] = float(price_val)
                                    result['priceRaw'] = f"${result['price']:.2f}"
            except:
                continue
    except:
        pass
    
    # === STRATEGY 2: OpenGraph Meta Tags ===
    if not result['title']:
        try:
            og = page.query_selector('meta[property="og:title"]')
            if og:
                result['title'] = og.get_attribute('content')
        except:
            pass
    
    if not result['image']:
        try:
            og = page.query_selector('meta[property="og:image"]')
            if og:
                result['image'] = og.get_attribute('content')
        except:
            pass
    
    if not result['description']:
        try:
            og = page.query_selector('meta[property="og:description"]')
            if og:
                result['description'] = og.get_attribute('content')
        except:
            pass
    
    # Price from meta
    if not result['price']:
        try:
            meta = page.query_selector('meta[property="product:price:amount"], meta[property="og:price:amount"]')
            if meta:
                price_val = meta.get_attribute('content')
                result['price'] = float(price_val)
                result['priceRaw'] = f"${result['price']:.2f}"
        except:
            pass
    
    # === STRATEGY 3: CSS Heuristics ===
    if not result['title']:
        title_selectors = ['h1', '.product-title', '.product-name', '[itemprop="name"]', 'title']
        for sel in title_selectors:
            try:
                el = page.query_selector(sel)
                if el:
                    text = el.inner_text().strip() if sel != 'title' else page.title()
                    if text and len(text) > 3 and len(text) < 300:
                        result['title'] = text
                        break
            except:
                continue
    
    if not result['price']:
        # Common price selectors
        price_selectors = [
            '[itemprop="price"]',
            '.price',
            '.product-price',
            '.current-price',
            '[data-price]',
            '.amount',
        ]
        for sel in price_selectors:
            try:
                el = page.query_selector(sel)
                if el:
                    price_text = el.inner_text().strip()
                    # Also try data-price attribute
                    if not price_text:
                        price_text = el.get_attribute('content') or el.get_attribute('data-price') or ''
                    
                    price_match = re.search(r'[\$€£]?\s*([\d,]+\.?\d*)', price_text)
                    if price_match:
                        result['price'] = float(price_match.group(1).replace(',', ''))
                        result['priceRaw'] = f"${result['price']:.2f}"
                        break
            except:
                continue
        
        # Last resort: regex search in page text
        if not result['price']:
            try:
                body_text = page.inner_text('body')[:5000]
                price_patterns = [
                    r'\$\s*([\d,]+\.\d{2})',
                    r'USD\s*([\d,]+\.\d{2})',
                    r'Price[:\s]*([\d,]+\.\d{2})',
                ]
                for pattern in price_patterns:
                    match = re.search(pattern, body_text)
                    if match:
                        result['price'] = float(match.group(1).replace(',', ''))
                        result['priceRaw'] = f"${result['price']:.2f}"
                        break
            except:
                pass
    
    if not result['image']:
        image_selectors = [
            '[itemprop="image"]',
            '.product-image img',
            '.gallery img',
            '#product-image',
            'img[src*="product"]',
            'main img',
        ]
        for sel in image_selectors:
            try:
                el = page.query_selector(sel)
                if el:
                    img = el.get_attribute('src') or el.get_attribute('data-src')
                    if img and img.startswith('http'):
                        result['image'] = img
                        break
            except:
                continue
    
    return result


# For testing
if __name__ == '__main__':
    import sys
    if len(sys.argv) > 1:
        test_url = sys.argv[1]
        result = scrape_with_playwright(test_url)
        print(json.dumps(result, indent=2))
