"""
Enhanced ProductSpider for Scrapy
Supports: Amazon, Etsy, Best Buy, Target, Walmart, and generic sites
Uses callback mechanism to pass data back to Flask
"""
import json
import re
from urllib.parse import urlparse
from scrapy import Request, Spider


class ProductSpider(Spider):
    name = 'product_spider'
    
    def __init__(self, url=None, on_item_scraped=None, user_id=None, *args, **kwargs):
        super(ProductSpider, self).__init__(*args, **kwargs)
        self.url = url
        self.start_urls = [url] if url else []
        self.on_item_scraped = on_item_scraped
        self.user_id = user_id
        
    def start_requests(self):
        """Start request with stealth headers"""
        yield Request(
            url=self.url,
            callback=self.parse,
            headers={
                'Referer': 'https://www.google.com/',
                'Sec-Fetch-User': '?1',
            },
            dont_filter=True,
            meta={'dont_redirect': True}
        )
    
    def parse(self, response):
        print(f"👀 SPIDER: Received response from {response.url}")
        
        domain = urlparse(self.url).netloc.lower()
        final_product = {}
        
        # Route to appropriate extractor
        if 'amazon' in domain:
            print("🛒 Detected Amazon")
            final_product = self.extract_amazon(response)
        elif 'etsy' in domain:
            print("🎨 Detected Etsy")
            final_product = self.extract_etsy(response)
        elif 'bestbuy' in domain:
            print("🛍️ Detected Best Buy")
            final_product = self.extract_bestbuy(response)
        elif 'target' in domain:
            print("🎯 Detected Target")
            final_product = self.extract_target(response)
        elif 'walmart' in domain:
            print("🏪 Detected Walmart")
            final_product = self.extract_walmart(response)
        else:
            print("🌐 Using generic extractor")
            final_product = self.extract_generic(response)
        
        # Fallback to JSON-LD if extraction incomplete
        if not final_product.get('price') or not final_product.get('title'):
            print("⚠️ Trying JSON-LD fallback...")
            json_ld = self.extract_json_ld(response)
            if json_ld:
                normalized = self.normalize_json_ld(json_ld, response.url)
                # Merge - keep existing data, fill gaps from JSON-LD
                for key, value in normalized.items():
                    if not final_product.get(key) and value:
                        final_product[key] = value
        
        # Yield result
        if final_product and final_product.get('title'):
            item = {
                'title': final_product.get('title', ''),
                'price': final_product.get('price'),
                'priceRaw': final_product.get('priceRaw'),
                'image': final_product.get('image', ''),
                'description': final_product.get('description', ''),
                'url': final_product.get('url', self.url),
                'user_id': self.user_id,
                'domain': domain.replace('www.', '')
            }
            
            if self.on_item_scraped:
                self.on_item_scraped(item)
            
            print(f"📦 RESULT: {item['title'][:50]}... | ${item.get('price', 'N/A')}")
            yield item
        else:
            print("❌ FAILED: Could not extract product data")
    
    def extract_amazon(self, response):
        """Amazon extraction with multiple fallbacks"""
        product = {'url': response.url}
        
        # Title
        title_selectors = [
            '#productTitle::text',
            '#title span::text',
            'h1.product-title-word-break::text',
        ]
        for sel in title_selectors:
            title = response.css(sel).get()
            if title and title.strip():
                product['title'] = title.strip()
                break
        
        # Price - prioritize "price to pay" selectors (actual current price)
        # IMPORTANT: Order matters - put most reliable first
        price_selectors = [
            # Actual price to pay (most accurate)
            '.priceToPay span.a-offscreen::text',
            '#corePrice_desktop .priceToPay span.a-offscreen::text',
            # Deal/sale prices
            '#priceblock_dealprice::text',
            '#priceblock_saleprice::text',
            '#priceblock_ourprice::text',
            # Desktop price display (avoid "was" prices by being specific)
            '#corePriceDisplay_desktop_feature_div .priceToPay span.a-offscreen::text',
            '#corePriceDisplay_desktop_feature_div .a-price:not(.a-text-price) span.a-offscreen::text',
            # Mobile/alternative layouts
            '#corePrice_feature_div .a-price span.a-offscreen::text',
            '#apex_desktop .priceToPay span.a-offscreen::text',
            # Kindle/Digital
            '#kindle-price::text',
            '#price_inside_buybox::text',
            # Fallback - first non-struck price (less accurate)
            '.a-price:not(.a-text-price) span.a-offscreen::text',
        ]
        for sel in price_selectors:
            price_text = response.css(sel).get()
            if price_text:
                price = self.clean_price(price_text)
                if price and price > 0:  # Make sure it's a valid price
                    product['price'] = price
                    product['priceRaw'] = f"${price:.2f}"
                    print(f"   💵 Found price via '{sel}': ${price:.2f}")
                    break
        
        # Image
        img = response.css('#landingImage::attr(src)').get()
        if not img:
            img = response.css('#imgBlkFront::attr(src)').get()
        if not img:
            img = response.css('#ebooksImgBlkFront::attr(src)').get()
        product['image'] = img
        
        # Description
        desc = response.css('#productDescription p::text').get()
        if desc:
            product['description'] = desc.strip()[:500]
        
        return product
    
    def extract_etsy(self, response):
        """Etsy extraction"""
        product = {'url': response.url}
        
        # Try JSON-LD first (most reliable for Etsy)
        json_ld = self.extract_json_ld(response)
        if json_ld:
            product = self.normalize_json_ld(json_ld, response.url)
            if product.get('title'):
                return product
        
        # CSS fallback
        title_selectors = [
            'h1[data-buy-box-listing-title]::text',
            'h1.listing-page-title::text',
            'h1.wt-text-body-01::text',
        ]
        for sel in title_selectors:
            title = response.css(sel).get()
            if title and title.strip():
                product['title'] = title.strip()
                break
        
        # Price
        price_selectors = [
            'p.wt-text-title-03 .currency-value::text',
            '[data-buy-box-region="price"] .currency-value::text',
        ]
        for sel in price_selectors:
            price_text = response.css(sel).get()
            if price_text:
                price = self.clean_price(price_text)
                if price:
                    product['price'] = price
                    product['priceRaw'] = f"${price:.2f}"
                    break
        
        # Image - try og:image
        img = response.css('meta[property="og:image"]::attr(content)').get()
        product['image'] = img
        
        return product
    
    def extract_bestbuy(self, response):
        """Best Buy extraction"""
        product = {'url': response.url}
        
        title = response.css('h1.heading-5::text').get()
        if not title:
            title = response.css('[data-testid="product-title"]::text').get()
        product['title'] = title.strip() if title else ''
        
        price = response.css('.priceView-customer-price span::text').get()
        if price:
            product['price'] = self.clean_price(price)
            product['priceRaw'] = price.strip()
        
        image = response.css('[data-testid="product-image"] img::attr(src)').get()
        product['image'] = image
        
        return product
    
    def extract_target(self, response):
        """Target extraction"""
        product = {'url': response.url}
        
        title = response.css('h1[data-test="product-title"]::text').get()
        product['title'] = title.strip() if title else ''
        
        price = response.css('[data-test="product-price"]::text').get()
        if price:
            product['price'] = self.clean_price(price)
            product['priceRaw'] = price.strip()
        
        image = response.css('[data-test="product-image"] img::attr(src)').get()
        product['image'] = image
        
        return product
    
    def extract_walmart(self, response):
        """Walmart extraction"""
        product = {'url': response.url}
        
        title = response.css('h1.prod-ProductTitle::text').get()
        if not title:
            title = response.css('[data-testid="product-title"]::text').get()
        product['title'] = title.strip() if title else ''
        
        price = response.css('[itemprop="price"]::attr(content)').get()
        if not price:
            price = response.css('[data-testid="price"]::text').get()
        if price:
            product['price'] = self.clean_price(price)
            product['priceRaw'] = f"${product['price']:.2f}" if product['price'] else None
        
        image = response.css('[data-testid="product-image"] img::attr(src)').get()
        product['image'] = image
        
        return product
    
    def extract_generic(self, response):
        """Generic extraction for independent websites"""
        product = {'url': response.url}
        
        # Title - try multiple sources
        title = (
            response.css('meta[property="og:title"]::attr(content)').get() or
            response.css('[itemprop="name"]::text').get() or
            response.css('h1::text').get() or
            response.css('title::text').get()
        )
        product['title'] = title.strip() if title else ''
        
        # Price - try multiple sources
        price = (
            response.css('[itemprop="price"]::attr(content)').get() or
            response.css('meta[property="product:price:amount"]::attr(content)').get() or
            response.css('.price::text').get() or
            response.css('.product-price::text').get()
        )
        if price:
            product['price'] = self.clean_price(price)
            product['priceRaw'] = price.strip()
        
        # Image
        image = (
            response.css('meta[property="og:image"]::attr(content)').get() or
            response.css('[itemprop="image"]::attr(src)').get() or
            response.css('.product-image img::attr(src)').get()
        )
        product['image'] = image
        
        # Description
        desc = (
            response.css('meta[property="og:description"]::attr(content)').get() or
            response.css('meta[name="description"]::attr(content)').get() or
            response.css('[itemprop="description"]::text').get()
        )
        product['description'] = desc.strip()[:500] if desc else ''
        
        return product
    
    def extract_json_ld(self, response):
        """Extract JSON-LD structured data"""
        try:
            scripts = response.xpath('//script[@type="application/ld+json"]/text()').getall()
            for script in scripts:
                try:
                    data = json.loads(script)
                    # Handle arrays
                    if isinstance(data, list):
                        for item in data:
                            if item.get('@type') in ['Product', 'IndividualProduct', 'Offer']:
                                return item
                    # Handle single object
                    if data.get('@type') in ['Product', 'IndividualProduct', 'Offer']:
                        return data
                except json.JSONDecodeError:
                    continue
        except Exception:
            pass
        return None
    
    def normalize_json_ld(self, data, url):
        """Normalize JSON-LD data to product format"""
        result = {'url': url}
        
        result['title'] = data.get('name') or data.get('title', '')
        result['description'] = data.get('description', '')[:500]
        
        # Image
        image = data.get('image', '')
        if isinstance(image, list):
            image = image[0] if image else ''
        if isinstance(image, dict):
            image = image.get('url') or image.get('contentUrl', '')
        result['image'] = image
        
        # Price
        offers = data.get('offers', {})
        if isinstance(offers, list):
            offers = offers[0] if offers else {}
        
        price = offers.get('price') or offers.get('lowPrice') or data.get('price')
        if price:
            try:
                result['price'] = float(price)
                currency = offers.get('priceCurrency', 'USD')
                result['priceRaw'] = f"${result['price']:.2f}"
            except (ValueError, TypeError):
                pass
        
        return result
    
    def clean_price(self, price_str):
        """Extract numeric price value"""
        if not price_str:
            return None
        
        # Remove currency symbols and extract numbers
        price_clean = re.sub(r'[^\d.,]', '', str(price_str))
        price_clean = price_clean.replace(',', '')
        
        try:
            return float(price_clean)
        except ValueError:
            return None
