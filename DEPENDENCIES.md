# Project Dependencies Overview

## ✅ Installed & In Use

### 1. HTML Parsing & Data Extraction

#### ✅ **cheerio** (`^1.1.2`)
- **Used for**: Fast, jQuery-like HTML parsing
- **Location**: `lib/scraper/structured-data.ts`, `pages/api/fetch-product-simple.ts`
- **Purpose**: Extract structured data (JSON-LD), meta tags, and product information
- **Why**: Lightweight, server-side DOM manipulation without browser overhead

#### ✅ **jsdom** (`^27.1.0`)
- **Used for**: HTML parsing and DOM manipulation
- **Location**: `lib/scraper/playwright-scraper.ts`, `lib/scraper/scrape-and-save.ts`
- **Purpose**: Parse HTML from Playwright and extract product data
- **Why**: More robust than regex, handles complex HTML structures

### 2. Browser Automation

#### ✅ **playwright** (`^1.40.0`)
- **Used for**: Headless browser automation
- **Location**: All scraper files
- **Purpose**: Navigate dynamic sites, handle JavaScript rendering
- **Why**: Industry standard, reliable, cross-browser support

#### ✅ **playwright-extra** (`^4.3.6`)
- **Used for**: Plugin system for Playwright
- **Location**: `lib/scraper/playwright-scraper.ts`, `lib/scraper/scrape-and-save.ts`
- **Purpose**: Enable stealth plugins to bypass bot detection
- **Why**: Extends Playwright with additional functionality

### 3. HTTP Requests & Fetching

#### ✅ **node-fetch** (`^2.7.0`)
- **Used for**: HTTP requests (fetch API for Node.js)
- **Location**: `lib/scraper/google-cache.ts`, `lib/scraper/scrape-and-save.ts`
- **Purpose**: Fetch HTML from URLs without browser overhead
- **Why**: Lightweight alternative to axios, built-in fetch API compatibility

### 4. Reliability & Concurrency

#### ✅ **p-retry** (`^7.1.0`) - NEW
- **Purpose**: Automatically retry failed requests
- **Usage**: Can be added to scraping functions for automatic retries
- **Example**:
```typescript
import pRetry from 'p-retry';

const result = await pRetry(
  () => scrapeProduct(url),
  { retries: 3, onFailedAttempt: error => console.log(`Attempt ${error.attemptNumber} failed`)}
);
```

#### ✅ **p-queue** (`^9.0.0`) - NEW
- **Purpose**: Control concurrency and rate limiting
- **Usage**: Queue multiple scraping requests to avoid rate limits
- **Example**:
```typescript
import PQueue from 'p-queue';

const queue = new PQueue({ concurrency: 2, interval: 1000 });
await queue.add(() => scrapeProduct(url1));
await queue.add(() => scrapeProduct(url2));
```

### 5. Metadata Extraction

#### ✅ **metascraper** (`^5.38.4`) + plugins
- **Used for**: Extract metadata from web pages
- **Location**: `lib/scraper/static-scraper.ts`
- **Plugins**: description, image, title, url
- **Purpose**: Fallback metadata extraction when structured data fails

### 6. Database & Backend

#### ✅ **@supabase/supabase-js** (`^2.38.0`)
- **Used for**: Supabase database client
- **Location**: `lib/scraper/scrape-and-save.ts`, `pages/api/fetch-product.ts`
- **Purpose**: Save scraped products to Supabase database

### 7. Frontend Framework

#### ✅ **next** (`^14.0.0`)
- **Used for**: React framework with API routes
- **Location**: Entire project
- **Purpose**: Full-stack application (frontend + API routes)
- **Note**: Includes built-in support for:
  - API routes (no need for Express)
  - CORS handling (no need for cors package)
  - Body parsing (no need for body-parser)
  - Environment variables (no need for dotenv)

#### ✅ **react** + **react-dom** (`^18.2.0`)
- **Used for**: UI components
- **Location**: `components/`, `pages/`

#### ✅ **framer-motion** (`^12.23.24`)
- **Used for**: Animations and motion
- **Location**: All component files

### 8. Styling

#### ✅ **tailwindcss** (`^3.3.6`)
- **Used for**: Utility-first CSS
- **Location**: `tailwind.config.js`, `styles/globals.css`

## ❌ Not Needed (Included in Next.js)

### **express** ❌
- **Why not needed**: Next.js has built-in API routes (`pages/api/`)
- **Alternative**: Use `pages/api/your-endpoint.ts`

### **cors** ❌
- **Why not needed**: Next.js API routes handle CORS automatically
- **Alternative**: Configure in `next.config.js` if needed

### **body-parser** ❌
- **Why not needed**: Next.js API routes parse JSON automatically
- **Alternative**: Just use `req.body` directly

### **dotenv** ❌
- **Why not needed**: Next.js automatically loads `.env.local` files
- **Alternative**: Just create `.env.local` and use `process.env.VAR_NAME`

### **axios** ❌
- **Why not needed**: We have `node-fetch` which is sufficient
- **Alternative**: Use `fetch()` or `node-fetch` (already installed)

## 🚀 Usage Examples

### Using p-retry for Automatic Retries

```typescript
// lib/scraper/scrape-with-retry.ts
import pRetry from 'p-retry';
import { scrapeAndSave } from './scrape-and-save';

export async function scrapeWithRetry(url: string, maxRetries = 3) {
  return pRetry(
    async () => {
      const result = await scrapeAndSave(url);
      if (!result.title || result.title === 'Unknown Item') {
        throw new Error('Failed to extract product data');
      }
      return result;
    },
    {
      retries: maxRetries,
      onFailedAttempt: (error) => {
        console.log(`Attempt ${error.attemptNumber} failed: ${error.message}`);
      },
    }
  );
}
```

### Using p-queue for Rate Limiting

```typescript
// lib/scraper/batch-scraper.ts
import PQueue from 'p-queue';
import { scrapeAndSave } from './scrape-and-save';

export async function scrapeBatch(urls: string[], concurrency = 2) {
  const queue = new PQueue({ 
    concurrency,
    interval: 1000, // 1 second between batches
    intervalCap: 1  // 1 request per interval
  });

  const results = await Promise.all(
    urls.map(url => 
      queue.add(async () => {
        console.log(`Scraping ${url}...`);
        return await scrapeAndSave(url);
      })
    )
  );

  return results;
}
```

## 📁 Current File Structure

```
wist/
├── lib/
│   └── scraper/
│       ├── scrape-and-save.ts      ← Main scraper with retry logic
│       ├── playwright-scraper.ts   ← Playwright + platform-specific
│       ├── static-scraper.ts       ← Static HTML scraping
│       ├── structured-data.ts      ← Cheerio extraction
│       ├── google-cache.ts         ← Google cache extraction
│       └── utils.ts                ← Utility functions
│
├── pages/
│   └── api/
│       └── fetch-product.ts        ← API endpoint
│
├── components/                      ← React components
├── styles/                         ← Global styles
├── .env.local                      ← Environment variables (gitignored)
├── package.json
└── next.config.js
```

## 🎯 Summary

✅ **Core Scraping**: Playwright + Cheerio + JSDOM  
✅ **Reliability**: p-retry + p-queue (NEW)  
✅ **Data Storage**: Supabase  
✅ **Frontend**: Next.js + React + Framer Motion  
✅ **Styling**: Tailwind CSS  

**All essential dependencies are installed and ready to use!**

