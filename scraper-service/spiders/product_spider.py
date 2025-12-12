"""
ProductSpider for Scrapy
Extracts product data from e-commerce sites
Uses callback mechanism to pass data back to Flask
"""
import json
import re
from urllib.parse import urlparse
from scrapy import Request, Spider
from scrapy import Item, Field


class ProductItem(Item):
    """Scrapy Item for product data"""
    title = Field()
    price = Field()
    priceRaw = Field()
    currency = Field()
    image = Field()
    description = Field()
    url = Field()


class ProductSpider(Spider):
    name = 'product_spider'
    
    def __init__(self, url=None, on_item_scraped=None, user_id=None, *args, **kwargs):
        super(ProductSpider, self).__init__(*args, **kwargs)
        self.url = url
        self.start_urls = [url] if url else []
        self.on_item_scraped = on_item_scraped  # Store the callback function
        self.user_id = user_id  # Save user_id to the class
        
    def start_requests(self):
        """
        Start request with stealth headers
        Note: DEFAULT_REQUEST_HEADERS from settings.py will be merged automatically
        Additional headers here will override defaults if needed
        """
        yield Request(
            url=self.url,
            callback=self.parse,
            headers={
                # These will be merged with DEFAULT_REQUEST_HEADERS from settings.py
                # User-Agent will be rotated by RandomUserAgentMiddleware
                'Referer': 'https://www.google.com/',  # Pretend we came from Google search
                'Sec-Fetch-User': '?1',  # Indicates user-initiated request
            },
            dont_filter=True,
            meta={'dont_redirect': True}
        )
    
    def parse(self, response):
        print(f"👀 SPIDER SUCCESS: Landed on {response.url}")
        
        final_product = {}
        domain = urlparse(self.url).netloc.lower()

        # STRATEGY: Try Domain-Specific Extractor FIRST (It sees the sale price)
        if 'amazon' in domain:
            print("🛒 Detected Amazon - Using visual extractor first")
            final_product = self.extract_amazon(response)
        elif 'bestbuy' in domain:
            final_product = self.extract_bestbuy(response)
        elif 'target' in domain:
            final_product = self.extract_target(response)

        # FALLBACK: If Amazon extractor failed (or it's a generic site), try JSON-LD
        if not final_product or not final_product.get('price'):
            print("⚠️ Visual extraction failed/incomplete, trying JSON-LD...")
            json_ld_data = self.extract_json_ld(response)
            if json_ld_data:
                final_product = self.normalize_json_ld(json_ld_data, response.url)

        # YIELD (Standard Logic)
        if final_product and final_product.get('title'):
            item = {
                'title': final_product.get('title', ''),
                'price': final_product.get('price'),
                'image': final_product.get('image', ''),
                'url': final_product.get('url', self.url),
                'user_id': self.user_id  # 👇 CRITICAL: Attach the ID here!
            }
            
            if self.on_item_scraped:
                self.on_item_scraped(item)

            print(f"📦 HANDING TO PIPELINE: {item['title']} (Price: {item['price']})")
            yield item
        else:
            print("❌ FAILED: Could not find product data.")
    
    def extract_json_ld(self, response):
        """Extract from JSON-LD structured data (schema.org)"""
        try:
            # Look for JSON-LD scripts
            scripts = response.xpath('//script[@type="application/ld+json"]/text()').getall()
            for script in scripts:
                try:
                    data = json.loads(script)
                    # Handle list of JSON-LD objects
                    if isinstance(data, list):
                        data = data[0] if data else {}
                    # Check if it's a Product
                    if data.get('@type') == 'Product' or 'Product' in str(data.get('@type', '')):
                        return data
                except json.JSONDecodeError:
                    continue
        except Exception:
            pass
        return None
    
    def normalize_json_ld(self, data, url):
        """Normalize Amazon/Schema.org data to simple interface"""
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
        
        # Handle image (can be string, list, or dict)
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
            "description": data.get('description', '')
        }
    
    def extract_opengraph(self, response):
        """Extract from OpenGraph meta tags"""
        return {
            "title": response.css('meta[property="og:title"]::attr(content)').get() or '',
            "price": None,
            "priceRaw": None,
            "currency": "USD",
            "image": response.css('meta[property="og:image"]::attr(content)').get() or '',
            "url": response.url,
            "description": response.css('meta[property="og:description"]::attr(content)').get() or ''
        }
    
    def extract_amazon(self, response):
        """
        Robust Amazon extraction that looks for the 'Deal Price' first.
        """
        product = {}
        
        # 1. TITLE extraction
        title = response.css('#productTitle::text').get()
        if title:
            product['title'] = title.strip()
            
        # 2. PRICE extraction (The tricky part)
        # We check these specific classes in order of accuracy
        price_selectors = [
            '.a-price.a-text-price.a-size-medium .a-offscreen::text',  # Deal price text
            '.a-price .a-offscreen::text',                            # Standard price text
            '#priceblock_ourprice::text',                             # Old style
            '#priceblock_dealprice::text',                            # Old style deal
            '.a-price-whole::text',                                   # Last resort (might miss cents)
        ]
        
        for selector in price_selectors:
            price_text = response.css(selector).get()
            if price_text:
                # Clean the price (remove currency symbol and whitespace)
                cleaned_price = price_text.replace('$', '').replace(',', '').strip()
                try:
                    product['price'] = float(cleaned_price)
                    # If we found a valid price, STOP looking
                    break 
                except ValueError:
                    continue

        # 3. IMAGE extraction
        # Amazon often hides the hi-res image in a JSON object, but the simple ID works too
        img = response.css('#landingImage::attr(src)').get()
        if not img:
            img = response.css('#imgBlkFront::attr(src)').get()
        product['image'] = img

        return product
    
    def extract_bestbuy(self, response):
        """Best Buy specific extraction"""
        result = {}
        
        # Title
        title = response.css('h1.heading-5::text').get() or \
                response.css('h1.sr-only + h1::text').get() or \
                response.css('h1[data-testid="product-title"]::text').get()
        result['title'] = title.strip() if title else ''
        
        # Price
        price = response.css('.priceView-customer-price span::text').get() or \
                response.css('[data-testid="customer-price"]::text').get() or \
                response.css('.pricing-price__value::text').get()
        if price:
            result['priceRaw'] = price.strip()
            result['price'] = self.clean_price(price.strip())
        
        # Image
        image = response.css('img.product-image::attr(src)').get() or \
                response.css('[data-testid="product-image"]::attr(src)').get()
        result['image'] = image or ''
        result['currency'] = 'USD'
        
        return result
    
    def extract_target(self, response):
        """Target specific extraction"""
        result = {}
        
        # Title
        title = response.css('h1[data-test="product-title"]::text').get() or \
                response.css('h1::text').get()
        result['title'] = title.strip() if title else ''
        
        # Price
        price = response.css('[data-test="product-price"]::text').get() or \
                response.css('.h-padding-r-tiny::text').get()
        if price:
            result['priceRaw'] = price.strip()
            result['price'] = self.clean_price(price.strip())
        
        # Image
        image = response.css('[data-test="product-image"]::attr(src)').get()
        result['image'] = image or ''
        result['currency'] = 'USD'
        
        return result
    
    def extract_generic(self, response):
        """Generic extraction using meta tags and common selectors"""
        result = {}
        
        # Title from meta tags
        title = response.css('meta[property="og:title"]::attr(content)').get() or \
                response.css('meta[name="title"]::attr(content)').get() or \
                response.css('title::text').get()
        result['title'] = title.strip() if title else ''
        
        # Price from meta tags
        price = response.css('meta[property="product:price:amount"]::attr(content)').get() or \
                response.css('meta[property="og:price:amount"]::attr(content)').get()
        if price:
            result['priceRaw'] = price.strip()
            result['price'] = self.clean_price(price.strip())
        
        # Image from meta tags
        image = response.css('meta[property="og:image"]::attr(content)').get() or \
                response.css('meta[name="image"]::attr(content)').get()
        result['image'] = image or ''
        
        # Description
        desc = response.css('meta[property="og:description"]::attr(content)').get() or \
               response.css('meta[name="description"]::attr(content)').get()
        result['description'] = desc or ''
        result['currency'] = 'USD'
        
        return result
    
    def clean_price(self, price_str):
        """Extract numeric price value"""
        if not price_str:
            return None
        
        # Remove currency symbols and extract numbers
        price_clean = re.sub(r'[^\d.,]', '', price_str)
        price_clean = price_clean.replace(',', '')
        
        try:
            return float(price_clean)
        except ValueError:
            return None
