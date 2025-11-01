# Wist Scraper Service

Production-ready product scraper microservice with Playwright and metascraper fallback.

## Quick Start

### Local Development

1. Install dependencies:
```bash
npm ci
```

2. Install Playwright browsers:
```bash
npx playwright install chromium
```

3. Run in development mode:
```bash
npm run dev
```

4. Test the service:
```bash
curl -X POST http://localhost:3000/api/fetch-product \
  -H "Content-Type: application/json" \
  -d '{"url":"https://www.amazon.com/dp/B0CL7LVV1G"}'
```

### Build & Run Production

```bash
npm run build
npm start
```

### Docker

Build:
```bash
docker build -t wist-scraper-service:latest .
```

Run:
```bash
docker run -p 3000:3000 wist-scraper-service:latest
```

## Environment Variables

- `PORT` (default: 3000) - Server port
- `SUPABASE_URL` (optional) - Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY` (optional) - Supabase service role key for server-side writes
- `CACHE_TTL_MS` (optional, default: 6 hours) - Cache time-to-live in milliseconds
- `DOMAIN_MIN_INTERVAL_MS` (optional, default: 5 seconds) - Minimum interval between requests per domain

## API Endpoints

### `POST /api/fetch-product`

Fetch product data from a URL.

**Request Body:**
```json
{
  "url": "https://www.amazon.com/dp/B0CL7LVV1G",
  "save": false,
  "user_id": "optional-user-uuid"
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

**Error Responses:**
- `400` - Invalid URL or missing url field
- `403` - Site blocking automated access
- `429` - Rate limit exceeded
- `500` - Internal server error

### `GET /health`

Health check endpoint.

## Supported Sites

### Dynamic Sites (Playwright)
- Amazon
- Best Buy
- Target
- Walmart
- eBay

### Static Sites (Metascraper)
- Any site with Open Graph / JSON-LD metadata

## Deployment

### Render / Fly.io / Railway

1. Connect your GitHub repository
2. Configure environment variables
3. Use the provided Dockerfile
4. Deploy

**Important:** Do NOT run this service on Vercel serverless functions. Vercel doesn't support full Playwright/Chromium binaries.

## Frontend Integration

Your frontend should:

1. POST to `/api/fetch-product` with `{ url }`
2. Show loader while waiting
3. If `ok: true` → display preview with `data` fields
4. If `403` → show manual add fallback
5. On user confirmation, either:
   - Call your frontend backend to save
   - Or POST again with `{ url, save: true, user_id }` (requires Supabase env vars)

## Supabase Schema

Run this SQL in your Supabase SQL editor:

```sql
create table wishlist_items (
  id uuid default gen_random_uuid() primary key,
  user_id uuid not null,
  title text,
  description text,
  price numeric,
  price_raw text,
  currency text,
  image text,
  domain text,
  url text,
  meta jsonb,
  created_at timestamptz default now()
);

create index on wishlist_items (user_id);
```

## Troubleshooting

### Site Blocks (403)

- Service uses stealth techniques but some sites may still block
- Show manual add fallback to users
- Log blocked domains for monitoring
- Consider proxy rotation for high-volume scaling

### High Memory Usage

- Ensure browser instances are closed properly
- Reduce cache TTL if needed
- Scale service (upgrade Render/Fly plan)

### Rate Limiting

- Adjust `DOMAIN_MIN_INTERVAL_MS` if too aggressive
- Consider per-user rate limits instead of per-IP

## Production Notes

- **Caching**: In-memory (upgrade to Redis for multi-instance)
- **Rate Limiting**: Per-domain, per-IP (upgrade to per-user with auth)
- **Anti-Bot**: Stealth techniques + human-like interactions
- **Monitoring**: Log blocked domains and error rates
