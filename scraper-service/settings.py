# Scrapy settings for product_spider project
# Stealth configuration to avoid bot detection

BOT_NAME = 'product_spider'

SPIDER_MODULES = ['spiders']
NEWSPIDER_MODULE = 'spiders'

# --- STEALTH CONFIGURATION ---

# 1. Ignore robots.txt (Amazon explicitly blocks bots here)
ROBOTSTXT_OBEY = False

# 2. Slow down to human speed
DOWNLOAD_DELAY = 2  # Wait 2 seconds between requests
RANDOMIZE_DOWNLOAD_DELAY = True

# 3. Disable Cookies (prevents tracking session IDs that get flagged)
COOKIES_ENABLED = False

# 4. Enable User-Agent Rotation (The magic sauce)
# We disable the default UserAgentMiddleware and enable the random one
DOWNLOADER_MIDDLEWARES = {
    'scrapy.downloadermiddlewares.useragent.UserAgentMiddleware': None,
    'scrapy_user_agents.middlewares.RandomUserAgentMiddleware': 400,
}

# 5. Mimic a Real Browser's Headers
# These headers make the request look like it came from Chrome
DEFAULT_REQUEST_HEADERS = {
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
    'Accept-Language': 'en-US,en;q=0.9',
    'Accept-Encoding': 'gzip, deflate, br',
    'Cache-Control': 'max-age=0',
    'Upgrade-Insecure-Requests': '1',
    'Referer': 'https://www.google.com/',  # Pretend we came from Google
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'cross-site',
    'Sec-Fetch-User': '?1',
}

# 6. Concurrency Limiting (Don't hammer the server)
CONCURRENT_REQUESTS = 1
CONCURRENT_REQUESTS_PER_DOMAIN = 1

# 7. AutoThrottle (Adaptive delays)
AUTOTHROTTLE_ENABLED = True
AUTOTHROTTLE_START_DELAY = 2
AUTOTHROTTLE_MAX_DELAY = 10
AUTOTHROTTLE_TARGET_CONCURRENCY = 1.0
AUTOTHROTTLE_DEBUG = False

# 8. Logging (Keep it quiet)
LOG_LEVEL = 'ERROR'

# 9. Item Pipelines (None needed for our use case)
ITEM_PIPELINES = {}

# 10. Reactor Configuration
# SMART REACTOR SELECTION - Choose the correct reactor based on OS
# This forces Railway (Linux) to use EPollReactor and Windows to use SelectReactor
import sys

# ---------------------------------------------------------
# SMART REACTOR SELECTION
# This forces Railway (Linux) to use the correct engine
# and keeps Windows using the Windows engine.
# ---------------------------------------------------------
if sys.platform == 'linux':
    TWISTED_REACTOR = 'twisted.internet.epollreactor.EPollReactor'
else:
    # Default for Windows/Mac
    TWISTED_REACTOR = 'twisted.internet.selectreactor.SelectReactor'

