# Wist Architecture

## System Overview

Wist is a production-ready product scraper with anti-bot hardening, designed to reliably extract product information from e-commerce sites while avoiding detection and blocks.

## Component Diagram

```
┌─────────────────┐
│   Frontend       │
│   (Next.js)      │
│   Vercel         │
└────────┬─────────┘
         │ HTTP POST
         │ /api/fetch-product
         ▼
┌─────────────────┐
│  Scraper Service│
│  (Docker)        │
│  Render/Fly.io   │
│                  │
│  ┌─────────────┐ │
│  │ Playwright  │ │
│  │ + Stealth   │ │
│  └─────────────┘ │
│                  │
│  ┌─────────────┐ │
│  │ Metascraper │ │
│  │ (Fallback)  │ │
│  └─────────────┘ │
└────────┬─────────┘
         │
         ├──────────────┐
         ▼              ▼
┌──────────────┐  ┌─────────────┐
│   Supabase  │  │   Cache     │
│   (Postgres)│  │  (Memory)   │
└──────────────┘  └─────────────┘
```

## Data Flow

### 1. Product Scraping Flow

```
User Input URL
    ↓
Frontend: POST /api/fetch-product
    ↓
Scraper Service:
  ├─ Check Cache → Hit? Return cached
  ├─ Check Rate Limit → Exceeded? 429
  ├─ Extract Domain
  ├─ Is Dynamic? (Amazon/BestBuy/Target)
  │   ├─ Yes → Playwright Scraper
  │   │   ├─ Launch Chromium (stealth)
  │   │   ├─ Navigate with realistic headers
  │   │   ├─ Human-like delays/movements
  │   │   ├─ Extract JSON-LD + Selectors
  │   │   └─ Fallback to static if fails
  │   └─ No → Metascraper (OG tags)
  ├─ Normalize Data
  ├─ Detect Blocks (CAPTCHA keywords)
  ├─ Cache Result
  └─ Return JSON
```

### 2. Wishlist Save Flow

```
Product Preview (Frontend)
    ↓
User clicks "Add to Wishlist"
    ↓
Frontend: POST /api/wishlist
    ↓
API Route:
  ├─ Validate user (auth)
  ├─ Insert to Supabase
  ├─ RLS Policy Check
  └─ Return success/error
```

## Key Components

### Scraper Engine

**Location**: `lib/scraper/`

- **`index.ts`**: Orchestrator - decides Playwright vs metascraper
- **`playwright-scraper.ts`**: Dynamic site scraper with stealth
- **`static-scraper.ts`**: Metascraper for static sites
- **`utils.ts`**: Price normalization, domain extraction, block detection

**Anti-Bot Features**:
- Playwright-extra with stealth plugin
- Realistic user agent rotation
- Human-like mouse movements
- Randomized delays (600-1200ms)
- Proper headers (Accept-Language, etc.)

### Caching Layer

**Location**: `lib/cache.ts`

- In-memory cache (per-instance)
- 12-hour default TTL
- Cache key: normalized URL
- Upgradeable to Redis/Supabase cache table

### Rate Limiting

**Location**: `lib/rate-limit.ts`

- Per-domain, per-IP rate limiting
- 1 request per 10 seconds per domain
- In-memory store (upgradeable to Redis)
- Automatic cleanup of expired entries

### Database Schema

**Location**: `supabase/schema.sql`

**Tables**:
- `wishlist_items`: User wishlist storage
  - RLS policies: Users can only access their own items
  - Indexes on `user_id`, `created_at`, `domain`
- `product_cache` (optional): Persistent cache table

## Security Features

1. **Row Level Security (RLS)**: Supabase enforces user isolation
2. **Input Validation**: URL format validation before scraping
3. **Rate Limiting**: Prevents abuse and reduces detection risk
4. **Error Sanitization**: Don't expose internal errors to users
5. **Block Detection**: Detects CAPTCHA/block pages and returns friendly errors

## Anti-Bot Strategy

### Detection Avoidance

1. **Stealth Plugin**: Hides automation fingerprints
2. **Realistic Headers**: Matches real browser requests
3. **Human Behavior**: Random delays, mouse movements
4. **Proper Timing**: Waits for network idle, not fixed timeouts

### Fallback Strategy

1. Playwright fails → Try static scraper
2. Static scraper fails → Return error with manual add option
3. Block detected → Return 403 with helpful message

### Rate Limiting Strategy

- Conservative limits (1 req/10s per domain)
- Prevents pattern detection
- Per-IP tracking (upgrade to per-user with auth)

## Scalability Considerations

### Current Limitations

- In-memory cache (single instance)
- In-memory rate limiting (single instance)
- No request queuing
- Single Chromium instance at a time

### Upgrade Path

1. **Multi-Instance**: Use Redis for cache + rate limiting
2. **Request Queue**: Add BullMQ/Agenda for job queuing
3. **Browser Pool**: Pool of Chromium instances
4. **CDN**: Cache images via Cloudinary/Imgix
5. **Read Replicas**: Supabase read replicas for wishlist queries

## Monitoring Points

### Metrics to Track

- Scrape success rate (by domain)
- Block detection rate
- Cache hit rate
- Average latency (p50, p95, p99)
- Error rate by type
- Memory usage (scraper service)

### Alerting

- Block rate > 10% for any domain
- Error rate > 5%
- Latency p95 > 10s
- Memory usage > 80%

## Technology Stack

- **Frontend**: Next.js 14, React, TypeScript, Tailwind CSS
- **Backend**: Next.js API Routes
- **Scraper**: Playwright + playwright-extra-stealth
- **Fallback**: Metascraper (OG tags, JSON-LD)
- **Database**: Supabase (PostgreSQL)
- **Deployment**: Vercel (frontend), Render/Fly.io (scraper)
- **Container**: Docker with Chromium dependencies

## File Structure

```
wist/
├── components/          # React UI components
│   ├── ProductPreview.tsx
│   └── AddProductForm.tsx
├── lib/
│   ├── scraper/         # Core scraping logic
│   │   ├── index.ts
│   │   ├── playwright-scraper.ts
│   │   ├── static-scraper.ts
│   │   └── utils.ts
│   ├── supabase/        # Database operations
│   │   ├── client.ts
│   │   └── wishlist.ts
│   ├── cache.ts
│   └── rate-limit.ts
├── pages/
│   ├── api/             # API endpoints
│   │   ├── fetch-product.ts
│   │   └── wishlist.ts
│   ├── _app.tsx
│   └── index.tsx
├── supabase/
│   └── schema.sql       # Database schema
├── Dockerfile           # Container config
└── docs/
    ├── DEPLOYMENT.md
    ├── RUNBOOK.md
    └── QUICK_START.md
```

## Design Decisions

### Why Playwright over Puppeteer?

- Better stealth plugin support
- More realistic automation detection
- Better handling of dynamic content

### Why Separate Scraper Service?

- Vercel functions have limitations (memory, timeout)
- Playwright needs full Chromium binary
- Better resource control on dedicated service

### Why In-Memory Cache First?

- Simple, fast, zero dependencies
- Works for MVP
- Easy upgrade path to Redis later

### Why Rate Limiting?

- Reduces detection risk
- Prevents accidental abuse
- Protects service from overload

## Future Enhancements

1. **Authentication**: Add Supabase Auth for real user management
2. **Proxy Rotation**: For high-volume scraping
3. **Background Jobs**: Queue scrapes instead of real-time
4. **Analytics**: Track price changes over time
5. **Notifications**: Alert users on price drops
6. **Multi-language**: Support international retailers
7. **Image OCR**: Extract prices from images when text fails

---

**Last Updated**: December 2024
