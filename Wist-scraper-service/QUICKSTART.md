# Quick Start Guide

## ✅ Setup Complete!

The Wist Scraper Service is ready to use. Here's how to get it running:

## Local Development

### 1. Install Dependencies
```bash
cd Wist-scraper-service
npm install
```

### 2. Install Playwright Browsers
```bash
npx playwright install chromium
```

### 3. Run Dev Server
```bash
npm run dev
```

Server will start on http://localhost:3000

### 4. Test It
Open a new terminal and run:

**Health Check:**
```bash
curl http://localhost:3000/health
# Should return: {"status":"ok","service":"wist-scraper-service"}
```

**Test Product Scraping:**
```bash
curl -X POST http://localhost:3000/api/fetch-product \
  -H "Content-Type: application/json" \
  -d "{\"url\":\"https://www.amazon.com/dp/B0CL7LVV1G\"}"
```

## Production Build

```bash
# Build TypeScript
npm run build

# Run production server
npm start
```

## Docker Build & Run

```bash
# Build image
docker build -t wist-scraper-service:latest .

# Run container
docker run -p 3000:3000 wist-scraper-service:latest
```

## Environment Variables

Create `.env` file (optional):
```
PORT=3000
NODE_ENV=production
SUPABASE_URL=your-url (optional)
SUPABASE_SERVICE_ROLE_KEY=your-key (optional)
CACHE_TTL_MS=21600000
DOMAIN_MIN_INTERVAL_MS=5000
```

## API Documentation

### POST /api/fetch-product

**Request:**
```json
{
  "url": "https://www.amazon.com/dp/B0CL7LVV1G",
  "save": false,
  "user_id": "optional-uuid"
}
```

**Success Response (200):**
```json
{
  "ok": true,
  "data": {
    "title": "Product Name",
    "price": 29.99,
    "priceRaw": "$29.99",
    "currency": "USD",
    "image": "https://...",
    "description": "...",
    "domain": "amazon.com",
    "url": "https://...",
    "blocked": false
  }
}
```

### GET /health

**Response (200):**
```json
{
  "status": "ok",
  "service": "wist-scraper-service"
}
```

## Deployment

See `DEPLOY.md` for Render/Fly.io/Railway deployment instructions.

## Troubleshooting

### Port 3000 Already in Use
Change the port:
```bash
PORT=3001 npm run dev
```

### Playwright Install Fails
Try installing with system dependencies:
```bash
npx playwright install chromium --with-deps
```

### Build Errors
Clean and rebuild:
```bash
rm -rf dist node_modules
npm install
npm run build
```

## Next Steps

1. Test with real product URLs
2. Deploy to Render/Fly.io/Railway
3. Integrate with your frontend
4. Configure Supabase (optional)
5. Set up monitoring

For detailed documentation, see `README.md`.


