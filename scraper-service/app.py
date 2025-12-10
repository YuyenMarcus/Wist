#!/usr/bin/env python3
"""
Flask microservice for product scraping with Scrapy
Uses crochet to manage Scrapy's Twisted reactor lifecycle
CRITICAL: Let Scrapy use whatever reactor crochet sets up (SelectReactor)
"""
import uuid
import time
from flask import Flask, request, jsonify
from flask_cors import CORS

# Initialize Crochet - it will set up the SelectReactor
from crochet import setup, wait_for
setup()

# Now import Scrapy components
from scrapy.crawler import CrawlerRunner
from scrapy.utils.project import get_project_settings
from spiders.product_spider import ProductSpider

app = Flask(__name__)
CORS(app)  # Allow Next.js frontend to call this

# In-memory job store (upgrade to Redis in production)
JOBS = {}

# Global storage for scraped items (keyed by job_id)
SCRAPED_ITEMS = {}

# Job statuses
STATUS_PENDING = 'pending'
STATUS_PROCESSING = 'processing'
STATUS_COMPLETED = 'completed'
STATUS_FAILED = 'failed'


def get_scrapy_settings():
    """
    Get Scrapy settings with stealth configuration
    Loads from settings.py file (stealth mode enabled)
    """
    # Load project settings (includes stealth config from settings.py)
    settings = get_project_settings()
    
    # Force override critical settings just in case
    settings.set('ROBOTSTXT_OBEY', False)
    settings.set('LOG_LEVEL', 'ERROR')
    
    # CRITICAL: Ensure we use SelectReactor (matches what crochet installs)
    settings.set('TWISTED_REACTOR', 'twisted.internet.selectreactor.SelectReactor')
    
    # Ensure user-agent rotation is enabled
    if 'scrapy_user_agents.middlewares.RandomUserAgentMiddleware' not in settings.get('DOWNLOADER_MIDDLEWARES', {}):
        settings.set('DOWNLOADER_MIDDLEWARES', {
            'scrapy.downloadermiddlewares.useragent.UserAgentMiddleware': None,
            'scrapy_user_agents.middlewares.RandomUserAgentMiddleware': 400,
        })
    
    return settings


def try_playwright_fallback(job_id, url):
    """
    Executes the Playwright scraper synchronously as fallback.
    Playwright uses real browser (authentic TLS fingerprint).
    
    Note: In a heavy production app, this should be a Celery task
    """
    print(f"🔄 Job {job_id}: Starting Playwright fallback...")
    
    try:
        from playwright_scraper import scrape_with_playwright
        
        # Run the scraping logic
        result = scrape_with_playwright(url)
        
        if result and result.get('title') and "amazon.com" not in result.get('title', '').lower():
            # SUCCESS - Check for captcha trap one more time
            if not detect_captcha_trap(result):
                print(f"✅ Job {job_id}: Playwright fallback succeeded! Title: {result['title'][:50]}...")
                JOBS[job_id]["status"] = STATUS_COMPLETED
                JOBS[job_id]["data"] = result
                JOBS[job_id]["completed_at"] = time.time()
            else:
                # Still detected as captcha
                print(f"❌ Job {job_id}: Playwright also detected captcha.")
                JOBS[job_id]["status"] = STATUS_FAILED
                JOBS[job_id]["error"] = "All scraping methods failed or detected captcha"
                JOBS[job_id]["completed_at"] = time.time()
        else:
            # FAILED - No title or generic title
            title = result.get('title', 'None') if result else 'None'
            print(f"❌ Job {job_id}: Playwright also failed (title: '{title[:50]}')")
            JOBS[job_id]["status"] = STATUS_FAILED
            JOBS[job_id]["error"] = "All scraping methods failed"
            JOBS[job_id]["completed_at"] = time.time()
            
    except ImportError:
        # Playwright not installed
        print(f"❌ Job {job_id}: Playwright not installed. Run: pip install playwright && playwright install chromium")
        JOBS[job_id]["status"] = STATUS_FAILED
        JOBS[job_id]["error"] = "Scrapy failed and Playwright not available. Install: pip install playwright && playwright install chromium"
        JOBS[job_id]["completed_at"] = time.time()
    except Exception as e:
        print(f"❌ Job {job_id}: Playwright crashed: {e}")
        JOBS[job_id]["status"] = STATUS_FAILED
        JOBS[job_id]["error"] = f"Playwright fallback failed: {str(e)}"
        JOBS[job_id]["completed_at"] = time.time()


def detect_captcha_trap(data):
    """
    Detect if we got a captcha/robot check page instead of product data
    Returns True if this looks like a captcha trap
    
    Amazon often returns 200 OK even when blocking, so we check for:
    1. Empty/missing data
    2. Generic titles (soft blocks)
    3. Missing price (blocked pages rarely have prices)
    """
    # 1. Check for empty data
    if not data:
        return True
    
    title = data.get('title', '').lower().strip()
    price = data.get('price')
    priceRaw = data.get('priceRaw')
    image = data.get('image')
    
    # 2. Check for "Soft Blocks" (Generic Titles)
    # Amazon returns these when blocking but still gives 200 OK
    suspicious_titles = [
        "amazon.com",
        "amazon.com: online shopping",
        "robot check",
        "sorry! something went wrong",
        "page not found",
        "access denied",
        "unusual traffic",
        "verify you're not a robot"
    ]
    
    # Check if title matches any suspicious pattern
    if any(suspicious in title for suspicious in suspicious_titles):
        return True
    
    # 3. Check for missing price (often happens on blocked pages)
    # Real product pages almost always have a price
    if not price and not priceRaw:
        # Exception: Some products legitimately have no price (out of stock, coming soon)
        # But if title is also generic, it's likely a block
        if not title or len(title) < 10 or title in ['amazon.com', 'amazon', 'target.com', 'best buy']:
            return True
    
    # 4. Check for captcha keywords in title
    captcha_keywords = [
        'robot', 'captcha', 'verify', 'unusual traffic',
        'access denied', 'blocked', 'suspicious activity',
        'automated access', 'bot detected'
    ]
    
    for keyword in captcha_keywords:
        if keyword in title:
            return True
    
    # 5. If title is just the site name and no price/image, it's likely a trap
    if title in ['amazon.com', 'amazon', 'target.com', 'best buy', 'target', 'bestbuy']:
        if price is None and not image:
            return True
    
    return False


@wait_for(timeout=60.0)  # 60s timeout
def run_spider(url, job_id):
    """
    Run Scrapy spider using CrawlerRunner (managed by crochet)
    This runs in a separate thread managed by crochet's reactor
    
    CRITICAL: Uses callback mechanism to capture scraped items
    """
    settings = get_scrapy_settings()
    runner = CrawlerRunner(settings)
    
    # Define the callback that the Spider will call
    def store_scraped_item(item):
        """Callback function to store scraped item"""
        print(f"✅ Job {job_id} found item: {item.get('title', '')[:50]}...")
        SCRAPED_ITEMS[job_id] = item  # Store in global dict
    
    # Pass the callback to the spider via arguments
    deferred = runner.crawl(ProductSpider, url=url, on_item_scraped=store_scraped_item)
    
    def on_success(result):
        """Called when crawl completes successfully"""
        # Check if we got an item via callback
        item_data = SCRAPED_ITEMS.get(job_id)
        
        if item_data:
            # Check for captcha trap
            if detect_captcha_trap(item_data):
                # Scrapy detected captcha → Try Playwright fallback
                print(f"⚠️  Job {job_id}: Scrapy detected captcha (title: '{item_data.get('title', '')[:50]}'), trying Playwright fallback...")
                try_playwright_fallback(job_id, url)
            else:
                # Success with Scrapy!
                print(f"✅ Job {job_id}: Scrapy succeeded! Title: '{item_data.get('title', '')[:50]}...'")
                JOBS[job_id]["status"] = STATUS_COMPLETED
                JOBS[job_id]["data"] = item_data
                JOBS[job_id]["completed_at"] = time.time()
        else:
            # No data from Scrapy → Try Playwright fallback
            print(f"⚠️  Job {job_id}: Scrapy returned no data, trying Playwright fallback...")
            try_playwright_fallback(job_id, url)
        
        # Clean up
        if job_id in SCRAPED_ITEMS:
            del SCRAPED_ITEMS[job_id]
        
        return result
    
    def on_error(failure):
        """Called when crawl fails"""
        JOBS[job_id]["status"] = STATUS_FAILED
        error_msg = str(failure.value) if hasattr(failure, 'value') else str(failure)
        JOBS[job_id]["error"] = error_msg
        JOBS[job_id]["completed_at"] = time.time()
        
        # Clean up
        if job_id in SCRAPED_ITEMS:
            del SCRAPED_ITEMS[job_id]
        
        return failure
    
    deferred.addCallbacks(on_success, on_error)
    return deferred


@app.route('/health', methods=['GET'])
def health():
    """Health check endpoint"""
    return jsonify({
        "status": "healthy",
        "service": "wist-scraper",
        "python": True,
        "scrapy": True,
        "crochet": True
    }), 200


@app.route('/api/scrape', methods=['POST'])
def start_scrape_job():
    """
    Create a new scraping job (async)
    Returns job_id immediately, client polls for status
    """
    data = request.get_json()
    url = data.get('url') if data else None
    
    if not url:
        return jsonify({"error": "URL required"}), 400
    
    # Validate URL
    try:
        from urllib.parse import urlparse
        parsed = urlparse(url)
        if not parsed.scheme or not parsed.netloc:
            return jsonify({"error": "Invalid URL format"}), 400
    except Exception:
        return jsonify({"error": "Invalid URL format"}), 400
    
    # Create job
    job_id = str(uuid.uuid4())
    JOBS[job_id] = {
        "id": job_id,
        "status": STATUS_PROCESSING,
        "url": url,
        "data": None,
        "error": None,
        "started_at": time.time()
    }
    
    # Initialize item storage for this job
    SCRAPED_ITEMS[job_id] = None
    
    # Start the scrape in the background (crochet manages the reactor)
    try:
        run_spider(url, job_id)
    except Exception as e:
        JOBS[job_id]["status"] = STATUS_FAILED
        JOBS[job_id]["error"] = str(e)
        JOBS[job_id]["completed_at"] = time.time()
        if job_id in SCRAPED_ITEMS:
            del SCRAPED_ITEMS[job_id]
        return jsonify({
            "error": "Failed to start scrape job",
            "detail": str(e)
        }), 500
    
    return jsonify({
        "job_id": job_id,
        "status": STATUS_PROCESSING,
        "url": url,
        "message": "Job created, polling /api/job/<job_id> for status"
    }), 202


@app.route('/api/job/<job_id>', methods=['GET'])
def check_status(job_id):
    """
    Get job status and result
    Returns data in format expected by TypeScript frontend
    """
    job = JOBS.get(job_id)
    
    if not job:
        return jsonify({"error": "Job not found"}), 404
    
    response = {
        "job_id": job_id,
        "status": job["status"],
        "url": job["url"],
        "started_at": job.get("started_at")
    }
    
    if job["status"] == STATUS_COMPLETED:
        # Return result in format: { status: "completed", result: { title, price, ... } }
        response["result"] = job["data"]
        response["completed_at"] = job.get("completed_at", time.time())
    elif job["status"] == STATUS_FAILED:
        response["error"] = job.get("error", "Unknown error")
        response["completed_at"] = job.get("completed_at", time.time())
    
    return jsonify(response)


@app.route('/api/scrape/sync', methods=['POST'])
def scrape_sync():
    """
    Synchronous scraping endpoint (for fast methods only)
    Note: Still uses crochet, but waits for result
    """
    data = request.get_json()
    url = data.get('url') if data else None
    
    if not url:
        return jsonify({"error": "URL required"}), 400
    
    job_id = str(uuid.uuid4())
    JOBS[job_id] = {
        "id": job_id,
        "status": STATUS_PROCESSING,
        "url": url,
        "data": None,
        "error": None,
        "started_at": time.time()
    }
    
    SCRAPED_ITEMS[job_id] = None
    
    try:
        # Run spider and wait for result (crochet handles this)
        run_spider(url, job_id)
        
        # Poll until complete (with timeout)
        max_wait = 30  # 30 second timeout for sync
        start_time = time.time()
        
        while JOBS[job_id]["status"] == STATUS_PROCESSING:
            if time.time() - start_time > max_wait:
                if job_id in SCRAPED_ITEMS:
                    del SCRAPED_ITEMS[job_id]
                return jsonify({
                    "success": False,
                    "error": "Scraping timeout"
                }), 504
            
            time.sleep(0.5)  # Check every 500ms
        
        if JOBS[job_id]["status"] == STATUS_COMPLETED:
            return jsonify({
                "success": True,
                "result": JOBS[job_id]["data"]
            }), 200
        else:
            return jsonify({
                "success": False,
                "error": JOBS[job_id].get("error", "Scraping failed")
            }), 500
            
    except Exception as e:
        if job_id in SCRAPED_ITEMS:
            del SCRAPED_ITEMS[job_id]
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500


if __name__ == '__main__':
    print("=" * 60)
    print("Starting Wist Scraper Service...")
    print("Using crochet to manage Scrapy reactor")
    print("Service will be available at http://0.0.0.0:5000")
    print("=" * 60)
    app.run(host='0.0.0.0', port=5000, debug=False)
