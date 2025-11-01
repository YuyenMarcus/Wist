# Wist - Reliable Product Scraper & Wishlist Manager

A bulletproof product scraper with anti-bot hardening, supporting Amazon, Best Buy, Target, and other retailers. Built with Next.js, Playwright, and Supabase.

## Features

- 🔒 **Anti-Bot Hardened**: Playwright with stealth plugin, realistic headers, human-like interactions
- 🎯 **Smart Fallbacks**: Falls back to metascraper for non-dynamic sites
- ⚡ **Caching**: In-memory caching (upgradeable to Redis)
- 🚦 **Rate Limiting**: Per-domain rate limiting to avoid blocks
- 🛡️ **Block Detection**: Detects CAPTCHA/block pages and returns helpful errors
- 📦 **Normalized Output**: Consistent JSON schema for all products
- 💾 **Supabase Integration**: Store wishlists with Row Level Security

## Architecture

```
Frontend (Vercel) → Scraper Service (Render/Fly) → Playwright/Metascraper
                              ↓
                        Supabase (DB)
```

## Quick Start

### 1. Install Dependencies

```bash
npm install
npx playwright install --with-deps
```

### 2. Set Up Supabase

1. Create a Supabase project
2. Run `supabase/schema.sql` in SQL Editor
3. Copy your project URL and anon key

### 3. Configure Environment Variables

Create `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
NODE_ENV=development
```

### 4. Run Development Server

```bash
npm run dev
```

Visit `http://localhost:3000`

## API Endpoints

### `POST /api/fetch-product`

Fetch product data from a URL.

**Request:**
```json
{
  "url": "https://www.amazon.com/dp/B08N5WRWNW"
}
```

**Response:**
```json
{
  "ok": true,
  "data": {
    "title": "Product Name",
    "price": 29.99,
    "priceRaw": "$29.99",
    "currency": "USD",
    "image": "https://...",
    "domain": "amazon.com",
    "url": "https://...",
    "description": "..."
  }
}
```

### `POST /api/wishlist`

Save a product to wishlist.

**Request:**
```json
{
  "title": "...",
  "price": 29.99,
  ...
}
```

**Headers:**
```
x-user-id: <user-uuid>
```

## Supported Sites

### Dynamic Sites (Playwright)
- Amazon
- Best Buy
- Target

### Static Sites (Metascraper)
- Any site with Open Graph / JSON-LD metadata

## Deployment

See [DEPLOYMENT.md](./DEPLOYMENT.md) for complete deployment guide.

**TL;DR:**
1. Deploy scraper service to Render/Fly.io with Docker
2. Deploy frontend to Vercel
3. Set environment variables
4. Run Supabase schema

## Project Structure

```
wist/
├── components/          # React components
│   ├── ProductPreview.tsx
│   └── AddProductForm.tsx
├── lib/
│   ├── scraper/         # Scraping logic
│   │   ├── index.ts
│   │   ├── playwright-scraper.ts
│   │   ├── static-scraper.ts
│   │   └── utils.ts
│   ├── supabase/        # Supabase utilities
│   │   ├── client.ts
│   │   └── wishlist.ts
│   ├── cache.ts         # Caching utilities
│   └── rate-limit.ts    # Rate limiting
├── pages/
│   └── api/             # API routes
│       ├── fetch-product.ts
│       └── wishlist.ts
├── supabase/
│   └── schema.sql       # Database schema
├── Dockerfile           # Docker config
└── DEPLOYMENT.md        # Deployment guide
```

## Development

### Running Tests

```bash
npm test
```

### Linting

```bash
npm run lint
```

## Production Checklist

- [x] Playwright stealth plugin enabled
- [x] Realistic headers and user agent
- [x] Human-like delays and mouse movements
- [x] Rate limiting per domain
- [x] Block detection
- [x] Caching (in-memory)
- [ ] Redis cache (for multi-instance)
- [ ] Monitoring dashboard
- [ ] Alerting on block spikes

## Legal

- Respect robots.txt
- Include affiliate disclosure in footer
- User content license in TOS
- GDPR compliance for data deletion

## License

MIT

## Support

For deployment issues, see [DEPLOYMENT.md](./DEPLOYMENT.md) troubleshooting section.
