import express, { Request, Response } from 'express';
import cors from 'cors';
import { extractDomain, looksDynamic, parseCurrencyFromRaw, cleanPrice, detectBlock } from './utils';
import { staticScrape, playwrightScrape } from './scrapers';
import { getCache, setCache, generateCacheKey } from './cache';
import { checkRateLimit } from './rate-limit';
import { saveToSupabase, logScrapeError } from './supabase';
import { ScrapeRequest, ScrapeResponse, NormalizedProduct } from './types';

const app = express();

app.use(cors());
app.use(express.json());

// Health check
app.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', service: 'wist-scraper-service' });
});

// Main scraper endpoint
app.post('/api/fetch-product', async (req: Request, res: Response) => {
  const { url, save = false, user_id }: ScrapeRequest = req.body;

  if (!url || typeof url !== 'string') {
    return res.status(400).json({ error: 'Missing url in request body' });
  }

  // Validate URL format
  let domain: string | null;
  try {
    domain = extractDomain(url);
    if (!domain) {
      return res.status(400).json({ error: 'Invalid URL format' });
    }
  } catch (e) {
    return res.status(400).json({ error: 'Invalid URL format' });
  }

  // Check cache first
  const cacheKey = generateCacheKey(url);
  const cached = getCache<NormalizedProduct>(cacheKey);
  if (cached) {
    return res.status(200).json({ ok: true, data: cached, cached: true });
  }

  // Rate limiting per domain
  const clientId = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
  const rateLimit = checkRateLimit(domain, String(clientId));

  if (!rateLimit.allowed) {
    return res.status(429).json({
      error: 'Rate limit exceeded',
      retryAfter: rateLimit.retryAfter,
      message: `Please wait ${rateLimit.retryAfter} seconds before trying again.`,
    });
  }

  try {
    let result: {
      title?: string | null;
      image?: string | null;
      priceRaw?: string | null;
      description?: string | null;
      html?: string | null;
    } | null = null;

    if (looksDynamic(domain)) {
      // Attempt Playwright first for dynamic sites
      try {
        result = await playwrightScrape(url);
      } catch (err: any) {
        // Fallback to static if playwright fails
        console.error('Playwright scrape failed:', err?.message || err);
        
        // Log error to analytics
        const errorType = err?.message?.includes('timeout') ? 'timeout' : 
                        err?.message?.includes('blocked') ? 'blocked' :
                        err?.message?.includes('network') ? 'network_error' : 'unknown';
        await logScrapeError(url, domain, err?.message || String(err), errorType);
        
        try {
          result = await staticScrape(url);
        } catch (e: any) {
          console.error('Static fallback failed after playwright error:', e?.message || e);
          
          // Log final failure
          await logScrapeError(url, domain, `Both methods failed: ${err?.message} -> ${e?.message}`, 'unknown');
          
          return res.status(500).json({
            error: 'Both dynamic renderer and static scrape failed',
            detail: err?.message || String(err),
          });
        }
      }
    } else {
      // Static path for non-dynamic sites
      try {
        result = await staticScrape(url);
      } catch (err: any) {
        console.error('Static scrape failed:', err?.message || err);
        
        // Log static scrape errors
        const errorType = err?.message?.includes('timeout') ? 'timeout' : 
                        err?.message?.includes('network') ? 'network_error' : 'unknown';
        await logScrapeError(url, domain, err?.message || String(err), errorType);
        
        throw err;
      }
    }

    const htmlSample = (result.html || '').slice(0, 2000);
    const blocked = detectBlock(htmlSample);

    if (blocked) {
      // Log blocked access
      await logScrapeError(url, domain, 'Site detected blocking/captcha', 'blocked');
      
      return res.status(403).json({
        error: 'Site blocking automated access; try again via manual add or from a different IP.',
      });
    }

    const price = result.priceRaw ? cleanPrice(result.priceRaw) : null;
    const currency =
      result.priceRaw
        ? parseCurrencyFromRaw(result.priceRaw)
        : parseCurrencyFromRaw(result.description || null);

    const normalized: NormalizedProduct = {
      title: result.title && typeof result.title === 'string' ? result.title.trim() : null,
      price,
      priceRaw: result.priceRaw || null,
      currency,
      image: result.image || null,
      description: result.description || null,
      domain,
      url,
      blocked: false,
      rawHtmlSample: htmlSample || null,
    };

    // Cache successful results
    setCache(cacheKey, normalized);

    // Optionally save to Supabase if requested
    if (save && user_id) {
      const saveResult = await saveToSupabase(user_id, normalized);
      if (!saveResult.success) {
        console.error('Failed to save to Supabase:', saveResult.error);
        // Don't fail the request - return data to client anyway
      }
    }

    const response: ScrapeResponse = { ok: true, data: normalized };
    return res.status(200).json(response);
  } catch (err: any) {
    console.error('fetch-product error', err);
    
    // Log unexpected errors
    const errorType = err?.message?.includes('timeout') ? 'timeout' : 
                    err?.message?.includes('network') ? 'network_error' : 'unknown';
    await logScrapeError(url, domain || null, err?.message || String(err), errorType);
    
    return res.status(500).json({
      error: 'Unable to fetch product',
      detail: err?.message || String(err),
    });
  }
});

const PORT = Number(process.env.PORT || 3000);

app.listen(PORT, () => {
  console.log(`Wist scraper listening on ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`Cache TTL: ${process.env.CACHE_TTL_MS || '6 hours (default)'}`);
  console.log(`Rate limit interval: ${process.env.DOMAIN_MIN_INTERVAL_MS || '5 seconds (default)'}`);
});
