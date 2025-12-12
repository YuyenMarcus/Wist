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
    
    def __init__(self, url=None, on_item_scraped=None, *args, **kwargs):
        super(ProductSpider, self).__init__(*args, **kwargs)
        self.url = url
        self.start_urls = [url] if url else []
        self.on_item_scraped = on_item_scraped  # Store the callback function
        
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
        """Extract product data from the page"""
        print(f"👀 SPIDER SUCCESS: Landed on {response.url}")

        # 1. Attempt JSON-LD extraction
        json_ld_data = self.extract_json_ld(response)
        
        result = {}
        if json_ld_data:
            result = self.normalize_json_ld(json_ld_data, response.url)
        else:
            # 2. Fallback extraction
            domain = urlparse(self.url).netloc.lower()
            if 'amazon' in domain:
                result = self.extract_amazon(response)
            elif 'bestbuy' in domain:
                result = self.extract_bestbuy(response)
            elif 'target' in domain:
                result = self.extract_target(response)
            else:
                result = self.extract_generic(response)

        # 3. If we found data, Process it!
        if result and result.get('title'):
            # A. Prepare the data object (Dictionary)
            product_data = {
                'title': result.get('title', ''),
                'price': result.get('price'),
                'priceRaw': result.get('priceRaw', ''),
                'currency': result.get('currency', 'USD'),
                'image': result.get('image', ''),
                'description': result.get('description', ''),
                'url': result.get('url', self.url)
            }

            # B. Send to Frontend (This is what works now)
            if self.on_item_scraped:
                print(f"🚀 SENDING TO FRONTEND: {product_data['title']}")
                self.on_item_scraped(product_data)
            
            # C. Send to Database (This was broken, now fixed)
            print(f"📦 HANDING TO PIPELINE (DATABASE): {product_data['title']}")
            yield product_data 
            
        else:
            print("❌ FAILED: Could not find product title on page.")
    
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
        """Amazon-specific extraction"""
        result = {}
        
        # Title
        title_selectors = [
            '#productTitle::text',
            'h1.a-size-large::text',
            'span#productTitle::text',
            'h1 span::text'
        ]
        for selector in title_selectors:
            title = response.css(selector).get()
            if title:
                result['title'] = title.strip()
                break
        
        # Price
        price_selectors = [
            'span.a-price-whole::text',
            '.a-price .a-offscreen::text',
            '#priceblock_ourprice::text',
            '#priceblock_dealprice::text',
            'span.a-price-symbol + span::text',
            '.a-price-range .a-offscreen::text'
        ]
        for selector in price_selectors:
            price = response.css(selector).get()
            if price:
                result['priceRaw'] = price.strip()
                result['price'] = self.clean_price(price.strip())
                break
        
        # --- ROBUST AMAZON IMAGE EXTRACTION ---
        # Amazon uses lazy loading - src often contains a 1x1 placeholder
        # We need to check data-a-dynamic-image for the real high-res image
        image_url = None
        
        # Strategy 1: "data-a-dynamic-image" (The Gold Standard)
        # Amazon stores all resolutions in a JSON object inside this attribute
        try:
            img_data = response.css('#landingImage::attr(data-a-dynamic-image)').get() or \
                      response.css('#imgBlkFront::attr(data-a-dynamic-image)').get()  # For Books
            
            if img_data:
                # It's a JSON string like {"url1": [size], "url2": [size]}
                # We grab the first key (usually the best one)
                images = json.loads(img_data)
                if images:
                    image_url = list(images.keys())[0]
        except Exception:
            pass
        
        # Strategy 2: "data-old-hires" (Older Amazon pages)
        if not image_url:
            image_url = response.css('#landingImage::attr(data-old-hires)').get()
        
        # Strategy 3: Standard src (Fallback)
        if not image_url:
            image_url = response.css('#landingImage::attr(src)').get() or \
                       response.css('#imgTagWrapperId img::attr(src)').get() or \
                       response.css('#imgBlkFront::attr(src)').get() or \
                       response.css('img#main-image::attr(src)').get()
        
        # Strategy 4: JSON-LD (The Backup)
        if not image_url:
            try:
                script_data = response.xpath('//script[@type="application/ld+json"]//text()').get()
                if script_data:
                    data = json.loads(script_data)
                    # Handle list or dict
                    if isinstance(data, list):
                        for item in data:
                            if item.get('@type') == 'Product':
                                image_url = item.get('image')
                                if isinstance(image_url, list):
                                    image_url = image_url[0] if image_url else None
                                elif isinstance(image_url, dict):
                                    image_url = image_url.get('url')
                                break
                    elif isinstance(data, dict):
                        if data.get('@type') == 'Product':
                            image_url = data.get('image')
                            if isinstance(image_url, list):
                                image_url = image_url[0] if image_url else None
                            elif isinstance(image_url, dict):
                                image_url = image_url.get('url')
            except:
                pass
        
        # Clean the URL (remove any weird encoded spaces)
        if image_url:
            image_url = image_url.strip()
        
        result['image'] = image_url or ''
        
        # Description
        desc = response.css('#productDescription p::text').getall()
        result['description'] = ' '.join(desc).strip() if desc else ''
        result['currency'] = 'USD'
        
        return result
    
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
