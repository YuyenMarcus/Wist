# Deployment Guide V2 - Microservice Architecture

## Quick Answer to Your Questions

### 1. Deployment Status
**Current**: Local development only
**Target**: 
- Frontend → Vercel (Next.js)
- Scraper Service → Railway/Fly.io (Python Flask)

### 2. Python Scrapy Script
**Status**: ✅ Already written (`scraper/scrapy_scraper.py`)
**Bridge**: ✅ Created Flask microservice (`scraper-service/app.py`)

## Architecture Overview

```
┌─────────────────┐         ┌──────────────────┐
│  Next.js (Vercel)│  HTTP  │ Python Flask     │
│                 │────────▶│ (Railway/Fly.io) │
│  - Frontend     │         │  - Scrapy        │
│  - API Routes   │         │  - Job Queue     │
└─────────────────┘         └──────────────────┘
```

## Step-by-Step Deployment

### Step 1: Deploy Python Scraper Service

#### Option A: Railway (Recommended - Easiest)

1. **Create Railway Account**
   - Go to https://railway.app
   - Sign up with GitHub

2. **Create New Project**
   - Click "New Project"
   - Select "Deploy from GitHub repo"
   - Choose your `wist` repository

3. **Configure Service**
   - Set root directory: `scraper-service`
   - Railway auto-detects Dockerfile
   - Add environment variables (if needed):
     ```
     PORT=5000
     FLASK_ENV=production
     ```

4. **Deploy**
   - Railway builds and deploys automatically
   - Get the service URL (e.g., `https://wist-scraper-production.up.railway.app`)

#### Option B: Fly.io

```bash
cd scraper-service
fly launch
# Follow prompts
fly deploy
```

#### Option C: Local Testing First

```bash
cd scraper-service
pip install -r requirements.txt
python app.py
# Service runs on http://localhost:5000
```

### Step 2: Update Next.js Environment Variables

1. **Create `.env.local`** (for local development):
```env
NEXT_PUBLIC_SCRAPER_SERVICE_URL=http://localhost:5000
```

2. **Add to Vercel** (for production):
   - Go to Vercel project settings
   - Environment Variables
   - Add:
     ```
     NEXT_PUBLIC_SCRAPER_SERVICE_URL=https://your-scraper-service.railway.app
     ```

### Step 3: Test the Integration

1. **Start Python Service Locally**:
```bash
cd scraper-service
python app.py
```

2. **Start Next.js Dev Server**:
```bash
npm run dev
```

3. **Test Async Flow**:
   - Open browser to `http://localhost:3000`
   - Paste an Amazon URL
   - Should see engaging loading messages
   - Product should appear after scraping completes

### Step 4: Deploy Frontend to Vercel

1. **Push to GitHub** (if not already):
```bash
git add .
git commit -m "Add microservice architecture"
git push
```

2. **Deploy to Vercel**:
   - Go to https://vercel.com
   - Import your GitHub repository
   - Add environment variable: `NEXT_PUBLIC_SCRAPER_SERVICE_URL`
   - Deploy

## Current Implementation Status

### ✅ Completed
- [x] Python Flask microservice (`scraper-service/app.py`)
- [x] Async job queue system
- [x] Engaging loading messages in ProductInput
- [x] Price history data structure
- [x] Next.js API routes for async flow
- [x] Client library for scraper service

### ⏳ Next Steps
- [ ] Deploy Python service to Railway/Fly.io
- [ ] Update `NEXT_PUBLIC_SCRAPER_SERVICE_URL` in Vercel
- [ ] Test end-to-end async flow
- [ ] (Optional) Add Redis for persistent job queue

## Testing the Microservice

### Health Check
```bash
curl http://localhost:5000/health
```

### Create Async Job
```bash
curl -X POST http://localhost:5000/api/scrape \
  -H "Content-Type: application/json" \
  -d '{"url": "https://www.amazon.com/dp/B08N5WRWNW"}'
```

Response:
```json
{
  "job_id": "uuid-here",
  "status": "pending",
  "url": "https://...",
  "message": "Job created, polling /api/job/<job_id> for status"
}
```

### Poll Job Status
```bash
curl http://localhost:5000/api/job/<job_id>
```

## Migration from V1 to V2

### Current Flow (V1 - Won't work on Vercel)
```
Next.js API → spawns Python subprocess → Scrapy
```

### New Flow (V2 - Production Ready)
```
Next.js API → HTTP POST → Python Flask Service → Scrapy
```

### Code Changes Needed

**Before** (in `lib/scraper/index.ts`):
```typescript
// Direct subprocess call (won't work on Vercel)
const { stdout } = await execAsync(`python3 script.py "${url}"`);
```

**After** (use new client):
```typescript
// HTTP call to microservice
const job = await createScrapeJob(url);
const result = await pollJobUntilComplete(job.job_id);
```

## Troubleshooting

### Python Service Not Starting
- Check if port 5000 is available
- Verify dependencies: `pip install -r requirements.txt`
- Check Python version: `python --version` (needs 3.11+)

### Next.js Can't Connect to Service
- Verify `NEXT_PUBLIC_SCRAPER_SERVICE_URL` is set
- Check CORS is enabled in Flask (already done)
- Test service directly: `curl http://localhost:5000/health`

### Jobs Stuck in "Processing"
- Check Python service logs
- Verify Scrapy is installed: `python -c "import scrapy"`
- Check for errors in job result

## Production Considerations

1. **Job Queue**: Currently in-memory. For production, use Redis:
   ```python
   # Replace in-memory dict with Redis
   import redis
   r = redis.Redis(host='localhost', port=6379)
   ```

2. **Authentication**: Add API keys for production:
   ```python
   API_KEY = os.getenv('API_KEY')
   if request.headers.get('X-API-Key') != API_KEY:
       return jsonify({'error': 'Unauthorized'}), 401
   ```

3. **Monitoring**: Add logging and error tracking (Sentry, etc.)

4. **Scaling**: Use gunicorn with multiple workers (already in Dockerfile)

## Cost Estimate

- **Vercel**: Free tier (hobby plan)
- **Railway**: $5/month (hobby plan)
- **Fly.io**: Free tier available
- **Total**: ~$5/month for production deployment

## Next Steps After Deployment

1. Test async flow with Amazon URLs
2. Monitor job completion times
3. Add Redis for persistent job queue
4. Implement price drop alerts using price history
5. Add authentication/rate limiting


