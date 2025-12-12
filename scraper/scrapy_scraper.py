#!/usr/bin/env python3
"""
Scrapy-based scraper for product data extraction
Designed to avoid bot detection with proper headers, delays, and user agents
"""
import json
import sys
import re
from urllib.parse import urlparse
from scrapy.crawler import CrawlerProcess
from scrapy import Request, Spider
from scrapy.utils.project import get_project_settings
from scrapy.settings import Settings
import logging

# Suppress scrapy logs for cleaner output
logging.getLogger('scrapy').setLevel(logging.WARNING)


class ProductSpider(Spider):
    name = 'product_spider'
    
    def __init__(self, url, *args, **kwargs):
        super(ProductSpider, self).__init__(*args, **kwargs)
        self.url = url
        self.result = {}
        
    def start_requests(self):
        """Start request with proper headers to avoid bot detection"""
        yield Request(
            url=self.url,
            callback=self.parse,
            headers={
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.5',
                'Accept-Encoding': 'gzip, deflate, br',
                'Connection': 'keep-alive',
                'Upgrade-Insecure-Requests': '1',
                'Sec-Fetch-Dest': 'document',
                'Sec-Fetch-Mode': 'navigate',
                'Sec-Fetch-Site': 'none',
                'Cache-Control': 'max-age=0',
            },
            dont_filter=True,
            meta={'dont_redirect': True}
        )
    
    def parse(self, response):
        """Extract product data from the page"""
        domain = urlparse(self.url).netloc.lower()
        
        # Try to extract from JSON-LD structured data first
        json_ld_data = self.extract_json_ld(response)
        if json_ld_data:
            self.result = json_ld_data
            return
        
        # Domain-specific extraction
        if 'amazon' in domain:
            self.result = self.extract_amazon(response)
        elif 'bestbuy' in domain:
            self.result = self.extract_bestbuy(response)
        elif 'target' in domain:
            self.result = self.extract_target(response)
        else:
            # Generic extraction
            self.result = self.extract_generic(response)
    
    def extract_json_ld(self, response):
        """Extract from JSON-LD structured data (schema.org)"""
        try:
            json_scripts = response.css('script[type="application/ld+json"]::text').getall()
            for script in json_scripts:
                try:
                    data = json.loads(script)
                    # Handle arrays
                    if isinstance(data, list):
                        data = data[0] if data else {}
                    
                    # Extract Product schema
                    if data.get('@type') == 'Product' or 'Product' in str(data.get('@type', '')):
                        result = {}
                        
                        # Title
                        result['title'] = data.get('name') or data.get('title', '').strip()
                        
                        # Price
                        offers = data.get('offers', {})
                        if isinstance(offers, list):
                            offers = offers[0] if offers else {}
                        
                        price = offers.get('price') or data.get('price')
                        if price:
                            result['priceRaw'] = str(price)
                            result['price'] = self.clean_price(str(price))
                            result['currency'] = offers.get('priceCurrency') or data.get('priceCurrency', 'USD')
                        
                        # Image
                        image = data.get('image')
                        if isinstance(image, list):
                            image = image[0] if image else None
                        if isinstance(image, dict):
                            image = image.get('url')
                        result['image'] = image or ''
                        
                        # Description
                        result['description'] = data.get('description') or ''
                        
                        if result.get('title'):
                            return result
                except json.JSONDecodeError:
                    continue
        except Exception as e:
            pass
        return None
    
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
        
        # Image
        image = response.css('#landingImage::attr(src)').get() or \
                response.css('#imgBlkFront::attr(src)').get() or \
                response.css('img#main-image::attr(src)').get()
        result['image'] = image or ''
        
        # Description
        desc = response.css('#productDescription p::text').getall()
        result['description'] = ' '.join(desc).strip() if desc else ''
        
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


def scrape_url(url):
    """Main function to scrape a URL and return JSON result"""
    # Configure Scrapy settings
    settings = Settings()
    settings.set('USER_AGENT', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36')
    settings.set('ROBOTSTXT_OBEY', False)  # Don't check robots.txt
    settings.set('DOWNLOAD_DELAY', 1)  # 1 second delay between requests
    settings.set('RANDOMIZE_DOWNLOAD_DELAY', 0.5)  # Randomize delay
    settings.set('CONCURRENT_REQUESTS', 1)  # One request at a time
    settings.set('CONCURRENT_REQUESTS_PER_DOMAIN', 1)
    settings.set('AUTOTHROTTLE_ENABLED', True)
    settings.set('AUTOTHROTTLE_START_DELAY', 1)
    settings.set('AUTOTHROTTLE_MAX_DELAY', 3)
    settings.set('AUTOTHROTTLE_TARGET_CONCURRENCY', 1.0)
    settings.set('LOG_LEVEL', 'ERROR')  # Suppress logs
    
    result_container = {}
    
    class ResultCollector(ProductSpider):
        def closed(self, reason):
            result_container['result'] = self.result
            result_container['success'] = bool(self.result.get('title'))
    
    process = CrawlerProcess(settings)
    process.crawl(ResultCollector, url=url)
    process.start()
    
    return result_container.get('result', {})


if __name__ == '__main__':
    if len(sys.argv) < 2:
        print(json.dumps({'error': 'URL required'}))
        sys.exit(1)
    
    url = sys.argv[1]
    try:
        result = scrape_url(url)
        print(json.dumps(result, indent=2))
    except Exception as e:
        print(json.dumps({'error': str(e)}))



