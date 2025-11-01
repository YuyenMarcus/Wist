# Wist Deployment Guide

This guide covers deploying the Wist scraper service and frontend with anti-bot hardening.

## Architecture Overview

- **Frontend**: Next.js on Vercel (fast, serverless)
- **Scraper Service**: Docker container on Render/Fly.io/Railway (runs Playwright)
- **Database**: Supabase (PostgreSQL)
- **Caching**: In-memory (upgrade to Redis for production)

## Prerequisites

1. GitHub repository
2. Supabase account (free tier works)
3. Render/Fly.io account (free tier works)
4. Vercel account (free tier works)

## Step 1: Set Up Supabase

1. Create a new Supabase project
2. Go to SQL Editor and run `supabase/schema.sql`
3. Copy your project URL and anon key from Settings > API

## Step 2: Deploy Scraper Service (Docker)

### Option A: Render

1. Create a new **Web Service** on Render
2. Connect your GitHub repo
3. Settings:
   - **Build Command**: `docker build -t wist-scraper . && docker run --rm wist-scraper npm run build` (or use Render's auto-detection)
   - **Start Command**: `npm start`
   - **Environment**: Node.js
   - Add environment variables:
     - `NODE_ENV=production`
     - `PORT=3000`
     - `NEXT_PUBLIC_SUPABASE_URL` (from Supabase)
     - `NEXT_PUBLIC_SUPABASE_ANON_KEY` (from Supabase)
     - Optional: `SUPABASE_SERVICE_ROLE_KEY` (for admin ops)

4. Render will auto-detect Dockerfile and build
5. Note the service URL (e.g., `https://wist-scraper.onrender.com`)

### Option B: Fly.io

```bash
# Install Fly CLI
# Install from https://fly.io/docs/getting-started/installing-flyctl/

# Login
fly auth login

# Create app
fly launch --name wist-scraper

# Set secrets
fly secrets set NODE_ENV=production
fly secrets set NEXT_PUBLIC_SUPABASE_URL=your-url
fly secrets set NEXT_PUBLIC_SUPABASE_ANON_KEY=your-key

# Deploy
fly deploy
```

### Option C: Railway

1. Connect GitHub repo to Railway
2. Railway auto-detects Dockerfile
3. Add environment variables in Railway dashboard
4. Deploy

## Step 3: Update Frontend Configuration

Update your frontend API calls to point to the scraper service:

```typescript
// In your frontend code, update the fetch URL:
const SCRAPER_SERVICE_URL = process.env.NEXT_PUBLIC_SCRAPER_URL || 'http://localhost:3000';

// Use in components:
const response = await fetch(`${SCRAPER_SERVICE_URL}/api/fetch-product`, {
  method: 'POST',
  body: JSON.stringify({ url }),
});
```

Set environment variable in Vercel:
- `NEXT_PUBLIC_SCRAPER_URL=https://your-scraper-service.onrender.com`

## Step 4: Deploy Frontend to Vercel

1. Connect GitHub repo to Vercel
2. Framework preset: **Next.js**
3. Build settings: Auto-detected
4. Environment variables:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `NEXT_PUBLIC_SCRAPER_URL` (your scraper service URL)

5. Deploy

## Step 5: Production Hygiene Checklist

### ✅ Anti-Bot Measures

- [x] Playwright-extra with stealth plugin enabled
- [x] Realistic user agent and headers
- [x] Human-like mouse movements and delays
- [x] Rate limiting per domain (1 req/10s)

### ✅ Caching

- [ ] Replace in-memory cache with Redis (for production scale)
  - Or use Supabase `product_cache` table (schema included)

### ✅ Monitoring

- [ ] Set up logging dashboard (Render logs, Fly logs, or Grafana)
- [ ] Alert on block detection spikes (>= 10 blocks/hour)
- [ ] Monitor memory/CPU on scraper service

### ✅ Rate Limiting

Current: In-memory (per-process). For multi-instance:
- [ ] Use Redis for distributed rate limiting
- [ ] Implement per-IP rate limits

### ✅ Error Handling

- [x] Block detection heuristics
- [x] Graceful fallback to static scraper
- [x] User-friendly error messages

## Step 6: Testing Checklist

### Unit Tests

```bash
# Test price normalization
npm test -- lib/scraper/utils.test.ts

# Test domain detection
npm test -- lib/scraper/utils.test.ts
```

### Integration Tests

Test against real URLs:

```bash
# Amazon product
curl -X POST https://your-service.com/api/fetch-product \
  -H "Content-Type: application/json" \
  -d '{"url":"https://www.amazon.com/dp/B08N5WRWNW"}'

# Best Buy product
curl -X POST https://your-service.com/api/fetch-product \
  -H "Content-Type: application/json" \
  -d '{"url":"https://www.bestbuy.com/site/..."}'
```

### End-to-End

1. Paste URL in frontend
2. Verify preview shows image/title/price
3. Click "Add to Wishlist"
4. Verify item appears in wishlist

## Step 7: Monitoring & Runbook

### Monitoring Metrics

Track these in your logging dashboard:

- `scraped_count` - Successful scrapes
- `blocked_count` - Blocked requests (403)
- `error_count` - Other errors (500)
- `avg_latency` - Response time (ms)
- `cache_hit_rate` - Cache effectiveness

### Alert Thresholds

- **Blocked requests**: Alert if > 10/hour
- **Error rate**: Alert if > 5% of requests
- **Latency**: Alert if p95 > 10s

### Runbook: Site Blocking

**Symptom**: 403 errors increasing for a domain

**Actions**:
1. Check logs for block detection patterns
2. Review recent changes to scraper (headers, timing)
3. Temporarily increase delays or rotate user agents
4. Consider enabling manual add flow for blocked sites
5. If persistent, implement proxy rotation (paid service)

### Runbook: High Memory Usage

**Symptom**: Scraper service crashes or slows down

**Actions**:
1. Check Playwright browser instances not closing
2. Reduce cache TTL or implement cache size limits
3. Scale service (Render: upgrade plan, Fly: scale instances)
4. Enable garbage collection monitoring

### Runbook: Rate Limiting Issues

**Symptom**: Users getting 429 errors

**Actions**:
1. Review rate limit thresholds (may be too aggressive)
2. Implement per-user rate limits instead of per-IP
3. Add retry logic with exponential backoff in frontend

## Legal & Compliance

### Affiliate Disclosure

Add to your footer:

```html
<a href="/affiliate-disclosure">Affiliate Disclosure</a>
<a href="/terms">Terms</a>
<a href="/privacy">Privacy</a>
```

Content should include:
- Disclosure that prices are fetched from retailers
- Affiliate relationship disclosure (if applicable)
- User content license (for manual additions)

### robots.txt Compliance

Respect robots.txt:
- Check before scraping (optional, but recommended)
- Implement crawl-delay if specified
- Honor disallow rules for specific paths

### Data Privacy

- Don't log full HTML responses
- Only store normalized product data
- Implement data retention policies
- GDPR: Allow users to delete their data

## Scaling Considerations

### When to Upgrade

- **In-memory cache → Redis**: When running multiple scraper instances
- **Free tier → Paid**: When exceeding rate limits or memory limits
- **Single instance → Multiple**: For high availability

### Cost Estimates (Monthly)

- Supabase: Free tier (500MB DB) → $25/mo (8GB)
- Render: Free tier (512MB RAM) → $7/mo (512MB) → $25/mo (2GB)
- Fly.io: Free tier (3 shared VMs) → $5/mo per VM
- Vercel: Free tier (100GB bandwidth) → $20/mo (Pro)

### Performance Optimization

1. **Pre-warm cache**: Scrape popular domains on schedule
2. **Background jobs**: Queue scrapes instead of real-time
3. **CDN**: Cache images via Cloudinary/Imgix
4. **Database**: Add read replicas for wishlist queries

## Troubleshooting

### Playwright fails to install

Ensure Dockerfile includes all Chromium dependencies:
```dockerfile
RUN apt-get update && apt-get install -y \
  libnss3 libatk1.0-0 ...
```

### Scraper service timeout

Increase timeout in API route:
```typescript
await page.goto(url, { timeout: 30000 }); // 30s
```

### CORS errors

Add CORS headers to scraper service:
```typescript
res.setHeader('Access-Control-Allow-Origin', '*');
res.setHeader('Access-Control-Allow-Methods', 'POST');
```

## Support

For issues:
1. Check logs in Render/Fly dashboard
2. Review Supabase logs for DB errors
3. Test scraper endpoint directly with curl
4. Verify environment variables are set

---

**Last Updated**: December 2024
