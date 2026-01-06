# Wist Architecture V2 - Production Ready

## Problem Statement

**V1 Issues:**
- Next.js API routes calling Python subprocess (won't work on Vercel)
- Playwright + Chromium too large for Vercel serverless (50MB limit)
- Synchronous scraping causes 5-10s wait times (bad UX)
- No price history support for future price drop alerts

## Solution: Microservice Architecture

### Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    Next.js Frontend (Vercel)                 │
│  - Static pages & API routes (lightweight)                   │
│  - ProductInput with engaging loading messages               │
│  - Async job polling                                         │
└───────────────────────┬─────────────────────────────────────┘
                        │ HTTP
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│              Next.js API Routes (Vercel)                     │
│  - /api/fetch-product (sync, fast methods only)             │
│  - /api/fetch-product-async (creates job, returns job_id)   │
│  - /api/job-status/[jobId] (polls Python service)           │
└───────────────────────┬─────────────────────────────────────┘
                        │ HTTP
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│         Python Flask Service (Railway/Fly.io)               │
│  - /api/scrape (async job creation)                          │
│  - /api/job/<job_id> (job status polling)                   │
│  - /api/scrape/sync (fast sync scraping)                    │
│  - Background threads for job processing                     │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│                    Scrapy Scraper                            │
│  - JSON-LD extraction                                        │
│  - Domain-specific extractors                                │
│  - Anti-bot detection                                        │
└─────────────────────────────────────────────────────────────┘
```

## Data Flow

### Async Flow (Recommended for Slow Sites)

```
1. User pastes Amazon URL
   ↓
2. Frontend: POST /api/fetch-product-async
   ↓
3. Next.js API: POST http://scraper-service/api/scrape
   ↓
4. Python Service: Returns job_id immediately (202 Accepted)
   ↓
5. Frontend: Receives job_id, shows optimistic loading message
   ↓
6. Frontend: Polls /api/job-status/<job_id> every 1s
   ↓
7. Next.js API: Proxies to Python service /api/job/<job_id>
   ↓
8. Python Service: Returns status (pending/processing/completed)
   ↓
9. When completed: Frontend receives product data
```

### Sync Flow (Fast Sites)

```
1. User pastes simple product URL
   ↓
2. Frontend: POST /api/fetch-product
   ↓
3. Next.js API: Tries structured data extraction (fast, local)
   ↓
4. If fails: POST http://scraper-service/api/scrape/sync
   ↓
5. Python Service: Returns result immediately
```

## UX Improvements

### Engaging Loading Messages

Instead of static "Loading...", cycle through messages:
- "Locating product..."
- "Negotiating with the server..."
- "Dodging captcha bots..."
- "Extracting structured data..."
- "Almost there..."

### Optimistic Updates

For known slow sites (Amazon, Best Buy):
- Show skeleton card immediately
- Display domain-specific message: "Wist is negotiating with Amazon's gates..."
- Keep UI responsive while scraping happens in background

## Data Structure Updates

### Product Interface (with Price History)

```typescript
interface Product {
  id: string;
  title: string;
  image: string;
  price: string | null; // Backward compatibility
  priceRaw: string | null;
  currentPrice: number | null; // Normalized
  priceHistory: PriceHistoryEntry[]; // NEW: For price tracking
  description: string | null;
  url: string;
  domain: string;
  savedAt: string;
  lastPriceCheck?: string; // NEW: Last time price was checked
}

interface PriceHistoryEntry {
  date: string; // ISO date
  price: number | null;
  priceRaw: string | null;
}
```

## Deployment Strategy

### Frontend (Next.js)
- **Platform**: Vercel
- **Why**: Fast, free tier, automatic deployments
- **Limitations**: No long-running processes, 50MB limit

### Scraper Service (Python)
- **Platform Options**:
  - **Railway**: Easy Docker deployment, $5/month
  - **Fly.io**: Global edge deployment, free tier available
  - **AWS Fargate**: Enterprise-grade, pay-per-use
- **Why**: Supports long-running processes, Docker containers

### Database (Optional)
- **Platform**: Supabase
- **Why**: PostgreSQL with Row Level Security, free tier

## Environment Variables

### Next.js (Vercel)
```env
NEXT_PUBLIC_SCRAPER_SERVICE_URL=https://your-scraper-service.railway.app
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
```

### Python Service (Railway/Fly.io)
```env
PORT=5000
FLASK_ENV=production
```

## Migration Path

### Phase 1: Local Development ✅
- [x] Create Python Flask service
- [x] Update ProductInput with loading messages
- [x] Update Product interface for price history
- [x] Create async job endpoints

### Phase 2: Deploy Scraper Service
- [ ] Deploy Python service to Railway/Fly.io
- [ ] Test endpoints
- [ ] Update NEXT_PUBLIC_SCRAPER_SERVICE_URL

### Phase 3: Update Frontend
- [ ] Update ProductInput to use async flow for slow sites
- [ ] Add job polling logic
- [ ] Test end-to-end

### Phase 4: Production Hardening
- [ ] Add Redis for job queue (replace in-memory)
- [ ] Add authentication/API keys
- [ ] Add monitoring/logging
- [ ] Add retry logic

## Benefits

1. **Scalability**: Frontend and scraper scale independently
2. **Reliability**: Scraper failures don't crash frontend
3. **UX**: Async jobs keep UI responsive
4. **Future-Proof**: Price history ready for alerts feature
5. **Cost-Effective**: Use free tiers where possible

## Next Steps

1. Deploy Python service to Railway
2. Test async flow end-to-end
3. Add Redis for production job queue
4. Implement price drop alerts using price history









