"""
Playwright-based scraper for product extraction
Used as fallback when Scrapy fails (authentic TLS fingerprint)
Includes stealth settings to avoid bot detection
Enhanced with playwright-stealth for Etsy and other hard targets
"""
from playwright.sync_api import sync_playwright
import time
import random
import json
import re
from urllib.parse import urlparse

# Import stealth plugin (if available)
try:
    from playwright_stealth import stealth_sync
    STEALTH_AVAILABLE = True
except ImportError:
    STEALTH_AVAILABLE = False
    print("[Playwright] Warning: playwright-stealth not installed. Run: pip install playwright-stealth")


def scrape_with_playwright(url):
    """
    Scrapes a product URL using Playwright with enhanced stealth settings.
    Returns a normalized product dict or None on failure.
    
    CRITICAL: Uses playwright-stealth plugin + browser args to avoid bot detection.
    Enhanced for Etsy and other hard targets while maintaining Amazon compatibility.
    """
    print(f"[Playwright] Launching Stealth Browser for {url}...")
    
    with sync_playwright() as p:
        # Launch Chromium with stealth flags
        # Set headless=False to see browser (helpful for debugging Etsy security checks)
        browser = p.chromium.launch(
            headless=False,  # Set to True for production (False lets you see/manually solve captchas)
            args=[
                '--disable-blink-features=AutomationControlled',
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-infobars',
                '--window-position=0,0',
                '--ignore-certifcate-errors',
                '--ignore-certifcate-errors-spki-list',
            ]
        )
        
        # Create a context with realistic viewport and user agent
        context = browser.new_context(
            viewport={'width': 1280, 'height': 720},  # More realistic screen size
            user_agent='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            locale='en-US',
            timezone_id='America/New_York',
        )
        
        # STEALTH INJECTION: Overwrite the 'navigator.webdriver' property
        # This is the #1 way sites detect bots
        context.add_init_script("""
            Object.defineProperty(navigator, 'webdriver', {
                get: () => undefined
            });
        """)
        
        page = context.new_page()
        
        # CRITICAL: Apply playwright-stealth plugin (the magic mask 🎭)
        if STEALTH_AVAILABLE:
            stealth_sync(page)
            print("   [Playwright] Stealth mode activated 🎭")
        else:
            print("   [Playwright] Stealth plugin not available - using basic stealth")
        
        try:
            # 1. Navigate with a realistic timeout
            print(f"   [Playwright] Navigating to URL...")
            page.goto(url, timeout=60000, wait_until='domcontentloaded')
            
            # 2. Wait for page to settle (especially important for Etsy security checks)
            page.wait_for_timeout(3000)  # Give it 3 seconds to "settle"
            
            # 3. Random mouse movements (proves we're human)
            try:
                page.mouse.move(100, 100)
                page.mouse.move(200, 200)
            except:
                pass
            
            # 4. Random human delay
            delay = random.uniform(1, 3)
            print(f"   [Playwright] Waiting {delay:.1f}s (human behavior)...")
            time.sleep(delay)
            
            # 5. Check for security blocks (Etsy, etc.)
            page_title = page.title()
            print(f"   [Playwright] Page Title: '{page_title}'")
            
            if any(blocked in page_title.lower() for blocked in ['security check', 'pardon', 'verify you are human']):
                print("   ⚠️ [Playwright] Detected security check page")
                # Wait a bit more - sometimes it auto-resolves
                page.wait_for_timeout(5000)
                page_title = page.title()
                if any(blocked in page_title.lower() for blocked in ['security check', 'pardon', 'verify you are human']):
                    print("   ❌ [Playwright] Still blocked by security check")
                    # If headless=False, user can manually solve captcha here
                    return None
            
            # 6. Handle "Accept Cookies" banners (optional but helpful)
            # Try to click cookie banner if present
            try:
                cookie_button = page.query_selector('#sp-cc-accept, #accept-cookies, button[id*="accept"], button[data-testid*="accept"]')
                if cookie_button:
                    cookie_button.click(timeout=2000)
                    time.sleep(1)
            except:
                pass  # No cookie banner or already accepted
            
            # 7. Extract Data (Try JSON-LD first - the "Silver Bullet")
            print(f"   [Playwright] Extracting product data...")
            product = extract_data(page, url)
            
            # Log extraction method for debugging
            if product and product.get('title'):
                method = product.get('method', 'unknown')
                print(f"   [Playwright] Extraction method: {method}")
            
            browser.close()
            
            if product and product.get('title'):
                print(f"   [Playwright] Extraction complete. Title: '{product.get('title', '')[:50]}...'")
            else:
                print(f"   [Playwright] Extraction failed - no title found")
            
            return product
            
        except Exception as e:
            print(f"[Playwright] Error: {e}")
            browser.close()
            return None


def extract_data(page, url):
    """
    Hybrid extraction strategy: JSON-LD first, then CSS fallback to fill in blanks
    STRATEGY 1: JSON-LD structured data (most reliable)
    STRATEGY 2: CSS selectors (fill in missing fields)
    """
    domain = urlparse(url).netloc.lower()
    
    # Initialize data container
    extracted = {
        "title": None,
        "price": None,
        "priceRaw": None,
        "currency": "USD",
        "image": None,
        "description": None,
        "url": url,
        "method": "playwright"
    }
    
    # --- STEP 1: JSON-LD STRATEGY (Try to get everything from JSON) ---
    print("   [Playwright] Checking JSON-LD structured data...")
    try:
        # Find all script tags (sometimes there are multiple)
        scripts = page.locator('script[type="application/ld+json"]').all()
        
        for s in scripts:
            try:
                content = s.inner_text()
                data = json.loads(content)
                
                # Handle lists of JSON objects (Etsy format)
                if isinstance(data, list):
                    for item in data:
                        if item.get('@type') in ['Product', 'IndividualProduct']:
                            data = item
                            break
                
                # If we found a Product, extract data
                if isinstance(data, dict) and data.get('@type') in ['Product', 'IndividualProduct']:
                    print("   ✅ [Playwright] Found Product JSON!")
                    
                    # Extract title
                    if not extracted["title"]:
                        extracted["title"] = data.get("name") or data.get("title")
                    
                    # Extract image (Can be string, list, or object)
                    if not extracted["image"]:
                        img = data.get("image")
                        if isinstance(img, list) and len(img) > 0:
                            img = img[0]
                        if isinstance(img, dict):
                            img = img.get("url") or img.get("contentUrl") or img.get("@id")
                        extracted["image"] = img
                    
                    # Extract price (The tricky part - Etsy uses lowPrice/highPrice)
                    if not extracted["price"]:
                        offers = data.get("offers", {})
                        # Offers can be a list or a single object
                        if isinstance(offers, list) and len(offers) > 0:
                            offers = offers[0]
                        
                        if isinstance(offers, dict):
                            # Etsy often uses 'lowPrice' for aggregate offers
                            price_value = offers.get("price") or offers.get("lowPrice") or offers.get("highPrice")
                            if price_value:
                                # Convert to float if it's a number
                                if isinstance(price_value, (int, float)):
                                    extracted["price"] = float(price_value)
                                else:
                                    # Clean string price (remove $, USD, etc.)
                                    price_str = str(price_value).replace("$", "").replace("USD", "").replace(",", "").strip()
                                    try:
                                        extracted["price"] = float(price_str)
                                    except ValueError:
                                        pass
                                
                                # Get currency
                                currency = offers.get("priceCurrency", "USD")
                                extracted["currency"] = currency
                                
                                # Create priceRaw with $ symbol
                                if extracted["price"]:
                                    extracted["priceRaw"] = f"${extracted['price']:.2f}"
                    
                    # Extract description
                    if not extracted["description"]:
                        extracted["description"] = data.get("description")
                    
                    # Mark as JSON-LD method
                    extracted["method"] = "playwright_jsonld"
                    
            except Exception as e:
                # Skip malformed JSON and continue
                continue
                
    except Exception as e:
        print(f"   [Playwright] JSON-LD Error: {e}")
    
    # --- STEP 2: CSS FALLBACK (Fill in the blanks) ---
    # If JSON missed anything, look for it visually on the page
    
    # Fill in Title if missing
    if not extracted["title"]:
        print("   [Playwright] JSON missing Title, trying CSS...")
        try:
            title = page.title()
            h1 = page.locator("h1").first
            if h1.count() > 0:
                title = h1.inner_text().strip()
            # Validate it's not a generic site name
            if title and title.lower() not in ['amazon.com', 'amazon', 'etsy.com', 'etsy', 'security check', 'pardon']:
                extracted["title"] = title
        except:
            pass
    
    # Fill in Price if missing
    if not extracted["price"]:
        print("   [Playwright] JSON missing Price, trying CSS...")
        try:
            # List of known Etsy/Amazon price selectors
            price_selectors = [
                # Etsy
                "p.wt-text-title-03.wt-mr-xs-2",
                ".wt-text-title-larger",
                "span.currency-value",
                "p.wt-text-title-03",
                # Amazon
                ".a-price .a-offscreen",
                "#price_inside_buybox",
                "#priceblock_ourprice",
                "#priceblock_dealprice",
                "span.a-price-whole",
                # Generic
                "[data-test-id='price']",
                "[itemprop='price']",
                ".price-item"
            ]
            
            for sel in price_selectors:
                try:
                    el = page.locator(sel).first
                    if el.count() > 0:
                        raw_price = el.inner_text().strip()
                        # Regex to find standard price like 19.99 or 1,234.56
                        match = re.search(r"(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)", raw_price)
                        if match:
                            price_str = match.group(1).replace(",", "")
                            try:
                                extracted["price"] = float(price_str)
                                # Create priceRaw with $ symbol
                                extracted["priceRaw"] = f"${extracted['price']:.2f}"
                                print(f"   ✅ [Playwright] Found Price via CSS: {extracted['priceRaw']}")
                                break
                            except ValueError:
                                continue
                except:
                    continue
        except Exception as e:
            print(f"   [Playwright] CSS Price Error: {e}")
    
    # Fill in Image if missing
    if not extracted["image"]:
        print("   [Playwright] JSON missing Image, trying CSS...")
        try:
            # Etsy main image is usually in a specific container
            img_selectors = [
                ".image-carousel-container img",
                "#main-image-container img",
                "img.wt-max-width-full",
                "#landingImage",  # Amazon
                "#imgTagWrapperId img",  # Amazon
                "img#main-image",  # Amazon
                "[data-testid='product-image']",  # Best Buy
                "[data-test='product-image']"  # Target
            ]
            
            for sel in img_selectors:
                try:
                    img = page.locator(sel).first
                    if img.count() > 0:
                        extracted["image"] = img.get_attribute("src") or img.get_attribute("data-src")
                        if extracted["image"] and extracted["image"].startswith("http"):
                            print(f"   ✅ [Playwright] Found Image via CSS")
                            break
                except:
                    continue
        except Exception as e:
            print(f"   [Playwright] CSS Image Error: {e}")
    
    # Fill in Description if missing
    if not extracted["description"]:
        try:
            desc_selectors = [
                '#productDescription p',  # Amazon
                '[data-testid="product-description"]',  # Best Buy
                'meta[property="og:description"]'  # Open Graph
            ]
            for sel in desc_selectors:
                try:
                    if sel.startswith('meta'):
                        el = page.query_selector(sel)
                        if el:
                            extracted['description'] = el.get_attribute('content')
                    else:
                        el = page.query_selector(sel)
                        if el:
                            extracted['description'] = el.inner_text().strip()
                    if extracted['description']:
                        break
                except:
                    continue
        except:
            pass
    
    # Mark method if CSS was used
    if extracted["method"] == "playwright":
        extracted["method"] = "playwright_css"
    
    # Ensure priceRaw has $ symbol if we have a price
    if extracted["price"] and not extracted["priceRaw"]:
        extracted["priceRaw"] = f"${extracted['price']:.2f}"
    
    # Final logging
    title_preview = extracted['title'][:30] if extracted['title'] else 'None'
    price_preview = extracted['priceRaw'] or (f"${extracted['price']:.2f}" if extracted['price'] else 'N/A')
    img_status = 'Yes' if extracted['image'] else 'No'
    print(f"   [Playwright] Final Data: '{title_preview}...' | {price_preview} | Img: {img_status}")
    
    return extracted
    
    # --- STRATEGY 2: CSS FALLBACK (If JSON-LD failed or incomplete) ---
    print("   [Playwright] Using CSS selectors as fallback...")
    
    # Attempt to grab the Title (if not already extracted)
    if not extracted["title"]:
        title = page.title()
        
        # Refine title for Amazon
        try:
            title_el = page.query_selector('#productTitle')
            if title_el:
                title = title_el.inner_text().strip()
        except:
            pass
        
        # Try other title selectors (including Etsy-specific)
        if not title or title.lower() in ['amazon.com', 'amazon', 'etsy.com', 'etsy', 'security check', 'pardon']:
            title_selectors = [
                '#productTitle',  # Amazon
                'h1[data-testid="product-title"]',  # Best Buy
                'h1[data-test="product-title"]',    # Target
                'h1.wt-text-body-01',  # Etsy
                'h1.wt-text-title-01',  # Etsy (alternative)
                'h1[data-buy-box-listing-title]',  # Etsy
                'h1.product-title',
                'h1'  # Generic fallback
            ]
            for selector in title_selectors:
                try:
                    el = page.query_selector(selector)
                    if el:
                        title = el.inner_text().strip()
                        # Check if it's a real product title (not generic site name)
                        if title and title.lower() not in ['amazon.com', 'amazon', 'etsy.com', 'etsy', 'security check', 'pardon']:
                            break
                except:
                    continue
        
        extracted['title'] = title if title else None
    
    # Attempt to grab Price (if not already extracted from JSON-LD)
    if not extracted["price"]:
        price = None
        priceRaw = None
        price_selectors = [
            '.a-price .a-offscreen',  # Amazon
            '#priceblock_ourprice',   # Amazon Old
            '#priceblock_dealprice',  # Amazon Deal
            'span.a-price-whole',     # Amazon (parts)
            '.priceView-customer-price span',  # Best Buy
            '[data-testid="customer-price"]',  # Best Buy
            '[data-test="product-price"]',      # Target
            'p.wt-text-title-03.wt-mr-xs-2',  # Etsy
            'p.wt-text-title-larger',  # Etsy (alternative)
            'span.currency-value',  # Etsy
            '.wt-text-title-03',  # Etsy (generic)
            '.price-item',                     # Generic
            '[itemprop="price"]'               # Schema.org
        ]
        
        for sel in price_selectors:
            try:
                el = page.query_selector(sel)
                if el:
                    price_text = el.inner_text().strip()
                    # Clean currency symbols and extract number
                    price_clean = re.sub(r'[^\d.,]', '', price_text).replace(',', '')
                    try:
                        price = float(price_clean)
                        priceRaw = price_text
                        extracted["price"] = price
                        extracted["priceRaw"] = priceRaw
                        break
                    except ValueError:
                        continue
            except:
                continue
    
    # Attempt to grab Image (if not already extracted from JSON-LD)
    if not extracted["image"]:
        image = None
        image_selectors = [
            '#landingImage',           # Amazon
            '#imgTagWrapperId img',   # Amazon
            'img.wt-max-width-full',  # Etsy (main product image)
            '.primary-image',         # Generic
            'img#main-image',          # Amazon
            '[data-testid="product-image"]',  # Best Buy
            '[data-test="product-image"]',    # Target
            'meta[property="og:image"]'       # Open Graph
        ]
        
        for sel in image_selectors:
            try:
                if sel.startswith('meta'):
                    el = page.query_selector(sel)
                    if el:
                        image = el.get_attribute('content')
                else:
                    el = page.query_selector(sel)
                    if el:
                        image = el.get_attribute('src')
                
                if image and image.startswith('http'):
                    extracted["image"] = image
                    break
            except:
                continue
    
    # Attempt to grab Description (if not already extracted from JSON-LD)
    if not extracted["description"]:
        try:
            desc_selectors = [
                '#productDescription p',  # Amazon
                '[data-testid="product-description"]',  # Best Buy
                'meta[property="og:description"]'       # Open Graph
            ]
            for sel in desc_selectors:
                try:
                    if sel.startswith('meta'):
                        el = page.query_selector(sel)
                        if el:
                            extracted['description'] = el.get_attribute('content')
                    else:
                        el = page.query_selector(sel)
                        if el:
                            extracted['description'] = el.inner_text().strip()
                    if extracted['description']:
                        break
                except:
                    continue
        except:
            pass
    
    # Mark as CSS method if JSON-LD wasn't used
    if extracted["method"] == "playwright":
        extracted["method"] = "playwright_css"
    
    # Log final result
    title_preview = extracted['title'][:50] if extracted['title'] else 'None'
    price_preview = extracted['priceRaw'] or (f"${extracted['price']:.2f}" if extracted['price'] else 'N/A')
    print(f"   [Playwright] Result: '{title_preview}...' | {price_preview}")
    
    return extracted


def extract_json_ld_playwright(page):
    """
    Extract JSON-LD structured data using Playwright
    Handles both single objects and arrays (Etsy often uses arrays)
    """
    try:
        json_ld_script = page.evaluate("""
            () => {
                const scripts = document.querySelectorAll('script[type="application/ld+json"]');
                for (const script of scripts) {
                    try {
                        let data = JSON.parse(script.textContent);
                        
                        // Handle array of JSON-LD objects (common in Etsy)
                        if (Array.isArray(data)) {
                            for (const item of data) {
                                if (item['@type'] === 'Product' || 
                                    (Array.isArray(item['@type']) && item['@type'].includes('Product'))) {
                                    return item;
                                }
                            }
                        }
                        
                        // Handle single object
                        if (data['@type'] === 'Product' || 
                            (Array.isArray(data['@type']) && data['@type'].includes('Product'))) {
                            return data;
                        }
                    } catch (e) {
                        // Skip malformed JSON
                        continue;
                    }
                }
                return null;
            }
        """)
        return json_ld_script
    except Exception as e:
        print(f"   [Playwright] JSON-LD extraction error: {e}")
        return None


def normalize_json_ld(data, url):
    """Normalize JSON-LD to product format"""
    price = None
    currency = "USD"
    priceRaw = None
    
    offers = data.get('offers', {})
    if isinstance(offers, list) and offers:
        offer = offers[0]
        price = offer.get('price')
        currency = offer.get('priceCurrency', 'USD')
        priceRaw = f"{currency} {price}" if price else None
    elif isinstance(offers, dict):
        price = offers.get('price')
        currency = offers.get('priceCurrency', 'USD')
        priceRaw = f"{currency} {price}" if price else None
    
    image = data.get('image', '')
    if isinstance(image, list):
        image = image[0] if image else ''
    elif isinstance(image, dict):
        image = image.get('url', '')
    
    return {
        "title": data.get('name') or data.get('title', '').strip(),
        "price": float(price) if price else None,
        "priceRaw": priceRaw or (str(price) if price else None),
        "currency": currency,
        "image": image,
        "url": url,
        "description": data.get('description', ''),
        "method": "playwright"
    }
