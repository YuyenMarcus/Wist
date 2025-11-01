# Wist Runbook - Operational Guide

Quick reference for common issues and maintenance tasks.

## Quick Checks

### Service Health

```bash
# Check scraper service
curl https://your-scraper-service.onrender.com/api/fetch-product \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{"url":"https://www.amazon.com/dp/B08N5WRWNW"}'

# Check frontend
curl https://your-app.vercel.app
```

### Database Health

```sql
-- Check wishlist_items count
SELECT COUNT(*) FROM wishlist_items;

-- Check cache table (if using)
SELECT COUNT(*) FROM product_cache WHERE expires_at > now();

-- Check recent errors (if logging to DB)
SELECT * FROM wishlist_items WHERE created_at > now() - interval '1 hour';
```

## Common Issues

### Issue: 403 Blocked Responses

**Symptoms:**
- Users see "Site blocking automated access" error
- Specific domains returning 403 consistently

**Diagnosis:**
1. Check logs for block detection patterns
2. Test URL directly: `curl -v <url>`
3. Check if block is domain-specific

**Actions:**
1. Increase delays in `lib/scraper/playwright-scraper.ts`:
   ```typescript
   await page.waitForTimeout(1200 + Math.floor(Math.random() * 800)); // Was 600-1200ms
   ```

2. Rotate user agents (add to `playwright-scraper.ts`):
   ```typescript
   const USER_AGENTS = [
     'Mozilla/5.0 (Windows NT 10.0; Win64; x64) ...',
     'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) ...',
   ];
   const userAgent = USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
   ```

3. Enable manual add flow for affected domains
4. If persistent, consider proxy rotation (paid service)

**Prevention:**
- Monitor block rate per domain
- Alert when block rate > 10% for any domain
- Rotate delays/user agents proactively

---

### Issue: High Memory Usage / OOM

**Symptoms:**
- Scraper service crashes
- Render/Fly logs show "out of memory"
- Slow response times

**Diagnosis:**
```bash
# Check memory usage (if you have SSH access)
docker stats <container-id>
```

**Actions:**
1. **Check for browser leaks:**
   - Ensure `await browser.close()` is always called
   - Add try/finally blocks in playwright-scraper.ts
   - Add timeout to browser launch

2. **Reduce cache size:**
   - Lower cache TTL: `lib/cache.ts` → Change `DEFAULT_TTL`
   - Implement cache size limit (LRU eviction)

3. **Limit concurrent requests:**
   - Add request queue: Max 2-3 concurrent Playwright instances
   - Implement semaphore in API route

4. **Scale service:**
   - Render: Upgrade to paid plan (more RAM)
   - Fly.io: Scale to larger VM size

**Code Fix Example:**
```typescript
// lib/scraper/playwright-scraper.ts
const MAX_BROWSERS = 2;
const browserPool = new Semaphore(MAX_BROWSERS);

export async function playwrightScrape(url: string) {
  await browserPool.acquire();
  let browser: Browser | null = null;
  try {
    // ... scraping code
  } finally {
    if (browser) await browser.close();
    browserPool.release();
  }
}
```

---

### Issue: Rate Limit False Positives

**Symptoms:**
- Users getting 429 errors too frequently
- Legitimate users blocked

**Actions:**
1. **Increase rate limit window:**
   ```typescript
   // lib/rate-limit.ts
   const RATE_LIMIT_WINDOW = 10000; // 10 seconds → 5000 (5 seconds)
   const RATE_LIMIT_MAX = 1; // 1 → 2 requests per window
   ```

2. **Use per-user instead of per-IP:**
   ```typescript
   // pages/api/fetch-product.ts
   const userId = getUserId(req); // From auth
   const rateLimit = checkRateLimit(domain, userId);
   ```

3. **Implement exponential backoff in frontend:**
   ```typescript
   // components/AddProductForm.tsx
   if (response.status === 429) {
     const retryAfter = response.headers.get('Retry-After');
     setTimeout(() => handleRetry(), retryAfter * 1000);
   }
   ```

---

### Issue: Cache Not Working

**Symptoms:**
- Same URLs scraped repeatedly
- No cache hit logs

**Diagnosis:**
```typescript
// Add logging in pages/api/fetch-product.ts
console.log('Cache key:', cacheKey, 'Hit:', !!cached);
```

**Actions:**
1. **Check cache key generation:**
   - Ensure URLs are normalized (trailing slash, http vs https)
   - Normalize in `lib/cache.ts`:
   ```typescript
   export function generateCacheKey(url: string): string {
     const normalized = url.replace(/\/$/, '').toLowerCase();
     return `scrape:${normalized}`;
   }
   ```

2. **Switch to Redis (multi-instance):**
   - In-memory cache only works per-instance
   - Use Supabase `product_cache` table or Redis

---

### Issue: Slow Scraping

**Symptoms:**
- API responses > 10 seconds
- Timeout errors

**Actions:**
1. **Optimize Playwright timeouts:**
   ```typescript
   await page.goto(url, {
     waitUntil: 'domcontentloaded', // Faster than 'networkidle'
     timeout: 15000, // Reduce from 20000
   });
   ```

2. **Skip unnecessary waits:**
   ```typescript
   // Only wait for networkidle if needed
   if (isDynamic(domain)) {
     await page.waitForLoadState('networkidle', { timeout: 5000 });
   }
   ```

3. **Cache more aggressively:**
   - Increase cache TTL to 72 hours for stable products
   - Pre-warm cache for popular domains

4. **Use static scraper when possible:**
   - Expand `DYNAMIC_DOMAINS` list only for sites that actually need Playwright
   - Many sites work fine with metascraper

---

### Issue: Supabase Connection Errors

**Symptoms:**
- "Failed to save product" errors
- Database queries timing out

**Actions:**
1. **Check Supabase status:**
   - Visit https://status.supabase.com
   - Check project dashboard for errors

2. **Verify environment variables:**
   ```bash
   # In Vercel/Render dashboard
   echo $NEXT_PUBLIC_SUPABASE_URL
   echo $NEXT_PUBLIC_SUPABASE_ANON_KEY
   ```

3. **Check RLS policies:**
   ```sql
   -- Verify policies exist
   SELECT * FROM pg_policies WHERE tablename = 'wishlist_items';
   ```

4. **Test connection:**
   ```typescript
   // Test in API route
   const { data, error } = await supabase.from('wishlist_items').select('count');
   console.log('Supabase test:', error);
   ```

---

## Monitoring Dashboard Queries

### Block Rate by Domain

```sql
-- If logging blocks to DB
SELECT 
  domain,
  COUNT(*) FILTER (WHERE error LIKE '%blocking%') as blocks,
  COUNT(*) as total,
  ROUND(100.0 * COUNT(*) FILTER (WHERE error LIKE '%blocking%') / COUNT(*), 2) as block_rate
FROM scrape_logs
WHERE created_at > now() - interval '24 hours'
GROUP BY domain
ORDER BY block_rate DESC;
```

### Cache Hit Rate

```typescript
// Add to API route
const metrics = {
  cacheHits: 0,
  cacheMisses: 0,
};

// In handler:
if (cached) {
  metrics.cacheHits++;
} else {
  metrics.cacheMisses++;
}
```

### Average Response Time

```typescript
// Add timing
const start = Date.now();
const result = await scrapeProduct(url);
const duration = Date.now() - start;

// Log or send to monitoring service
console.log(`Scrape duration: ${duration}ms for ${domain}`);
```

---

## Maintenance Tasks

### Weekly

- [ ] Review block rate logs
- [ ] Check cache hit rate
- [ ] Verify Supabase connection health
- [ ] Review error logs for patterns

### Monthly

- [ ] Update Playwright/Chromium (security patches)
- [ ] Review and update user agents
- [ ] Clean expired cache entries (if using DB cache)
- [ ] Review rate limit thresholds

### Quarterly

- [ ] Security audit of dependencies
- [ ] Review and update supported domains list
- [ ] Performance optimization review
- [ ] Cost review (Supabase/Render/Fly usage)

---

## Emergency Contacts

- **Supabase Support**: https://supabase.com/support
- **Render Status**: https://status.render.com
- **Fly.io Status**: https://status.fly.io
- **Vercel Status**: https://vercel-status.com

---

## Quick Commands

```bash
# Restart scraper service (Render)
# Via Dashboard: Services → Your Service → Manual Deploy → Clear build cache & deploy

# Restart scraper service (Fly.io)
fly apps restart wist-scraper

# Check logs (Render)
# Via Dashboard: Services → Your Service → Logs

# Check logs (Fly.io)
fly logs -a wist-scraper

# Test scraper endpoint
curl -X POST https://your-service.com/api/fetch-product \
  -H "Content-Type: application/json" \
  -d '{"url":"https://www.amazon.com/dp/B08N5WRWNW"}' | jq

# Clear cache (if using Redis)
redis-cli FLUSHDB

# Clear cache (if using Supabase)
DELETE FROM product_cache WHERE expires_at < now();
```

---

**Last Updated**: December 2024
