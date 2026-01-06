# Quick Start - Scraper Service

## Installation

```bash
cd scraper-service
pip install -r requirements.txt
```

## Run Service

```bash
python app.py
```

Service will start on `http://localhost:5000`

## Test Health Check

```bash
curl http://localhost:5000/health
```

## Test Scraping

```bash
# Create async job
curl -X POST http://localhost:5000/api/scrape \
  -H "Content-Type: application/json" \
  -d '{"url": "https://www.amazon.com/dp/B08N5WRWNW"}'

# Get job status (replace <job_id> with actual ID)
curl http://localhost:5000/api/job/<job_id>
```

## Expected Output

**Health Check**:
```json
{
  "status": "healthy",
  "service": "wist-scraper",
  "python": true,
  "scrapy": true,
  "crochet": true
}
```

**Job Creation**:
```json
{
  "job_id": "uuid-here",
  "status": "processing",
  "url": "https://...",
  "message": "Job created, polling /api/job/<job_id> for status"
}
```

**Job Status (Completed)**:
```json
{
  "job_id": "uuid-here",
  "status": "completed",
  "url": "https://...",
  "result": {
    "title": "Product Name",
    "price": 29.99,
    "priceRaw": "$29.99",
    "image": "https://...",
    "description": "...",
    "url": "https://..."
  }
}
```

## Troubleshooting

### "ReactorAlreadyInstalledError"
- Ensure `crochet.setup()` is called before any Scrapy imports
- Restart the service

### "ModuleNotFoundError: No module named 'spiders'"
- Make sure you're running from `scraper-service/` directory
- Check that `spiders/__init__.py` exists

### Service won't start
- Check Python version: `python --version` (needs 3.11+)
- Verify dependencies: `pip list | grep -E "(scrapy|crochet|flask)"`









