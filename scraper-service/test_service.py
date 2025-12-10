#!/usr/bin/env python3
"""
Quick test to verify service can start
"""
import sys
import os

# Add current directory to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

try:
    print("Testing imports...")
    from crochet import setup
    setup()
    print("✅ Crochet setup OK")
    
    from scrapy.crawler import CrawlerRunner
    from scrapy.utils.project import get_project_settings
    print("✅ Scrapy imports OK")
    
    from spiders.product_spider import ProductSpider
    print("✅ Spider import OK")
    
    from playwright_scraper import scrape_with_playwright
    print("✅ Playwright import OK")
    
    from flask import Flask
    from flask_cors import CORS
    print("✅ Flask imports OK")
    
    print("\n✅ All imports successful!")
    print("Service should start without errors.")
    print("\nTo start service, run: python app.py")
    
except Exception as e:
    print(f"❌ Error: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)


