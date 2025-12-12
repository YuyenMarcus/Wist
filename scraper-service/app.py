#!/usr/bin/env python3
"""
Flask microservice for product scraping with Scrapy
Uses crochet to manage Scrapy's Twisted reactor lifecycle
CRITICAL: Let Scrapy use whatever reactor crochet sets up (SelectReactor)
"""
import os

# 1. IMPORT CROCHET FIRST - MUST BE BEFORE ANY OTHER IMPORTS
import crochet

# 2. RUN SETUP IMMEDIATELY - MUST RUN BEFORE FLASK, SCRAPY, OR ANYTHING ELSE
crochet.setup()

# 3. ONLY THEN import everything else
import uuid
import time
from datetime import datetime, timedelta
from flask import Flask, request, jsonify
from flask_cors import CORS
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Initialize Supabase (optional - won't crash if not configured)
try:
    from supabase import create_client, Client
    supabase_url = os.environ.get("SUPABASE_URL")
    supabase_key = os.environ.get("SUPABASE_KEY") or os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    supabase: Client = create_client(supabase_url, supabase_key) if supabase_url and supabase_key else None
    if supabase:
        print("✅ Supabase connected for caching")
    else:
        print("⚠️  Supabase not configured (caching disabled)")
except Exception as e:
    print(f"⚠️  Supabase initialization failed: {e}")
    supabase = None

# Now import Scrapy components (after crochet.setup())
from crochet import wait_for
from scrapy.crawler import CrawlerRunner
from scrapy.utils.project import get_project_settings
from spiders.product_spider import ProductSpider

# 👇 IMPORT THE PIPELINE DIRECTLY 👇
from pipelines import SupabasePipeline

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
    
    # 👇 CHANGE LOG LEVEL TO INFO (So we can see the logs!) 👇
    settings.set('LOG_LEVEL', 'INFO')
    
    # REMOVED: Windows-specific reactor setting - Railway (Linux) will auto-detect EPoll reactor
    # Don't force SelectReactor on Linux - let the system choose the best reactor
    # settings.set('TWISTED_REACTOR', 'twisted.internet.selectreactor.SelectReactor')
    
    # 👇 USE THE IMPORTED CLASS DIRECTLY 👇
    settings.set('ITEM_PIPELINES', {
        SupabasePipeline: 300,
    })
    
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
def run_spider(url, job_id, user_id=None):
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
    
    # Pass the callback and user_id to the spider via arguments
    deferred = runner.crawl(ProductSpider, url=url, on_item_scraped=store_scraped_item, user_id=user_id)
    
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
    # 👇 NEW: Get user_id from the frontend request
    user_id = data.get('user_id')
    
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
        # 👇 PASS user_id TO THE SPIDER
        run_spider(url, job_id, user_id)
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
    
    CACHE LOGIC:
    1. Check Supabase cache first (if configured)
    2. If found and fresh (< 6 hours old), return cached data
    3. Otherwise, scrape and save to cache
    """
    data = request.get_json()
    url = data.get('url') if data else None
    # 👇 NEW: Get user_id from the frontend request
    user_id = data.get('user_id')
    
    if not url:
        return jsonify({"error": "URL required"}), 400
    
    print(f"🔔 Request received for: {url} (user_id: {user_id})")
    
    # --- 1. CHECK DATABASE (CACHE) FIRST ---
    if supabase:
        try:
            # Check if we scraped this URL in the last 6 hours
            response = supabase.table('products').select("*").eq('url', url).execute()
            
            if response.data and len(response.data) > 0:
                cached_item = response.data[0]
                last_scraped = cached_item.get('last_scraped')
                
                # Check if cache is fresh (less than 6 hours old)
                if last_scraped:
                    try:
                        last_scraped_dt = datetime.fromisoformat(last_scraped.replace('Z', '+00:00'))
                        age_hours = (datetime.now(last_scraped_dt.tzinfo) - last_scraped_dt).total_seconds() / 3600
                        
                        if age_hours < 6:
                            print(f"✅ Found in Cache (Database): {cached_item.get('title', '')[:50]}... (age: {age_hours:.1f}h)")
                            
                            # Return the cached data immediately!
                            return jsonify({
                                "success": True,
                                "result": {
                                    "title": cached_item.get('title'),
                                    "price": cached_item.get('price'),
                                    "priceRaw": cached_item.get('price_raw') or cached_item.get('price'),
                                    "image": cached_item.get('image'),
                                    "description": cached_item.get('description'),
                                    "domain": cached_item.get('domain'),
                                    "url": cached_item.get('url'),
                                    "source": "cache"  # Let frontend know it was cached
                                }
                            }), 200
                        else:
                            print(f"⚠️  Cache expired ({age_hours:.1f}h old), re-scraping...")
                    except Exception as e:
                        print(f"⚠️  Error parsing cache timestamp: {e}, re-scraping...")
                else:
                    print(f"⚠️  Cache missing timestamp, re-scraping...")
        except Exception as e:
            print(f"⚠️  Database Read Error: {e}")
    
    # --- 2. IF NOT IN DB OR EXPIRED, SCRAPE IT ---
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
        # 👇 PASS user_id TO THE SPIDER
        run_spider(url, job_id, user_id)
        
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
            result_data = JOBS[job_id]["data"]
            
            # --- 3. SAVE TO SUPABASE CACHE ---
            if supabase and result_data:
                try:
                    from urllib.parse import urlparse
                    domain = urlparse(url).netloc.replace('www.', '')
                    
                    product_data = {
                        "url": url,
                        "title": result_data.get('title'),
                        "price": str(result_data.get('price', '')) if result_data.get('price') else None,
                        "price_raw": result_data.get('priceRaw') or result_data.get('price'),
                        "image": result_data.get('image'),
                        "description": result_data.get('description'),
                        "domain": domain,
                        "last_scraped": datetime.utcnow().isoformat() + 'Z',
                        "meta": {
                            "scraped_at": datetime.utcnow().isoformat(),
                            "method": "scrapy_playwright"
                        }
                    }
                    
                    # Use upsert to handle duplicates (update if exists, insert if new)
                    supabase.table('products').upsert(
                        product_data,
                        on_conflict='url'
                    ).execute()
                    
                    print(f"✅ Saved to Supabase cache: {result_data.get('title', '')[:50]}...")
                except Exception as e:
                    print(f"⚠️  Failed to save to Supabase cache: {e}")
                    # Don't fail the request if cache save fails
            
            return jsonify({
                "success": True,
                "result": result_data
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
    # Get port from environment variable (for Railway/Render) or default to 5000
    port = int(os.environ.get('PORT', 5000))
    
    print("=" * 60)
    print("Starting Wist Scraper Service...")
    print("Using crochet to manage Scrapy reactor")
    print(f"Service will be available at http://0.0.0.0:{port}")
    print("=" * 60)
    app.run(host='0.0.0.0', port=port, debug=False)
