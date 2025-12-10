# Wist Scraper Service (Python Flask)

Microservice for product scraping using Scrapy. Decoupled from Next.js frontend to avoid Vercel limitations.

## Architecture

```
Next.js Frontend (Vercel)
    ↓ HTTP POST
Python Flask Service (Railway/Fly.io)
    ↓
Scrapy Scraper
```

## Features

- **Async Job Queue**: Returns job_id immediately, client polls for status
- **Sync Endpoint**: For fast structured data extraction
- **CORS Enabled**: Allows Next.js frontend to call this service
- **Docker Ready**: Containerized for easy deployment

## Local Development

### 1. Install Dependencies

```bash
cd scraper-service
pip install -r requirements.txt
```

### 2. Run Service

```bash
python app.py
```

Service runs on `http://localhost:5000`

### 3. Test Endpoints

**Health Check:**
```bash
curl http://localhost:5000/health
```

**Create Async Job:**
```bash
curl -X POST http://localhost:5000/api/scrape \
  -H "Content-Type: application/json" \
  -d '{"url": "https://www.amazon.com/dp/B08N5WRWNW"}'
```

**Get Job Status:**
```bash
curl http://localhost:5000/api/job/<job_id>
```

**Sync Scrape (Fast):**
```bash
curl -X POST http://localhost:5000/api/scrape/sync \
  -H "Content-Type: application/json" \
  -d '{"url": "https://example.com/product"}'
```

## Deployment

### Option 1: Railway

1. Connect GitHub repo
2. Set root directory to `scraper-service`
3. Railway auto-detects Dockerfile
4. Set environment variables if needed
5. Deploy

### Option 2: Fly.io

```bash
cd scraper-service
fly launch
fly deploy
```

### Option 3: Docker

```bash
cd scraper-service
docker build -t wist-scraper .
docker run -p 5000:5000 wist-scraper
```

## Environment Variables

- `PORT` (optional): Port to run on (default: 5000)
- `FLASK_ENV`: `production` or `development`

## Production Notes

- Use `gunicorn` with multiple workers (already configured in Dockerfile)
- Consider Redis for job queue in production (currently in-memory)
- Add authentication/API keys for production
- Monitor memory usage (Scrapy can be memory-intensive)

## API Endpoints

### `GET /health`
Health check endpoint.

**Response:**
```json
{
  "status": "ok",
  "service": "wist-scraper-service",
  "python": true,
  "scrapy": true
}
```

### `POST /api/scrape`
Create async scraping job.

**Request:**
```json
{
  "url": "https://www.amazon.com/dp/..."
}
```

**Response (202 Accepted):**
```json
{
  "job_id": "uuid-here",
  "status": "pending",
  "url": "https://...",
  "message": "Job created, polling /api/job/<job_id> for status"
}
```

### `GET /api/job/<job_id>`
Get job status and result.

**Response (Pending):**
```json
{
  "job_id": "uuid-here",
  "status": "pending",
  "url": "https://...",
  "created_at": "2024-01-01T00:00:00"
}
```

**Response (Completed):**
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
    "description": "..."
  },
  "completed_at": "2024-01-01T00:00:00"
}
```

**Response (Failed):**
```json
{
  "job_id": "uuid-here",
  "status": "failed",
  "url": "https://...",
  "error": "Error message",
  "completed_at": "2024-01-01T00:00:00"
}
```

### `POST /api/scrape/sync`
Synchronous scraping (fast methods only).

**Request:**
```json
{
  "url": "https://example.com/product"
}
```

**Response:**
```json
{
  "success": true,
  "result": {
    "title": "Product Name",
    "price": 29.99,
    "priceRaw": "$29.99",
    "image": "https://...",
    "description": "..."
  }
}
```

## Next Steps

1. Add Redis for persistent job queue
2. Add authentication/API keys
3. Add rate limiting
4. Add monitoring/logging
5. Add retry logic for failed jobs


