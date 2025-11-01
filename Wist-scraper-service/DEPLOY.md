# Deployment Guide

## Quick Deploy to Render

1. **Push to GitHub**
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin <your-repo-url>
   git push -u origin main
   ```

2. **Create Render Service**
   - Go to https://render.com
   - Click "New" → "Web Service"
   - Connect your GitHub repo
   - Render will auto-detect the Dockerfile
   - Name: `wist-scraper-service`

3. **Environment Variables**
   Add in Render dashboard:
   ```
   PORT=3000
   NODE_ENV=production
   SUPABASE_URL=<your-url> (required for error analytics)
   SUPABASE_SERVICE_ROLE_KEY=<your-key> (required for error analytics)
   CACHE_TTL_MS=21600000 (optional, 6 hours default)
   DOMAIN_MIN_INTERVAL_MS=5000 (optional, 5 seconds default)
   ```

   **Note**: Error analytics logging requires Supabase configuration. If not set, errors will be logged to console only.

4. **Deploy**
   - Click "Create Web Service"
   - Render will build and deploy
   - Note the service URL (e.g., `https://wist-scraper-service.onrender.com`)

## Quick Deploy to Fly.io

1. **Install Fly CLI**
   ```bash
   # macOS
   brew install flyctl
   
   # Windows (PowerShell)
   powershell -Command "iwr https://fly.io/install.ps1 -useb | iex"
   ```

2. **Login & Create App**
   ```bash
   fly auth login
   fly launch
   ```

3. **Set Secrets**
   ```bash
   fly secrets set SUPABASE_URL=<your-url>
   fly secrets set SUPABASE_SERVICE_ROLE_KEY=<your-key>
   fly secrets set PORT=3000
   ```

4. **Deploy**
   ```bash
   fly deploy
   ```

## Quick Deploy to Railway

1. **Connect Repository**
   - Go to https://railway.app
   - Click "New Project" → "Deploy from GitHub repo"
   - Select your repository

2. **Configure**
   - Railway auto-detects Dockerfile
   - Add environment variables in dashboard

3. **Deploy**
   - Click "Deploy"
   - Railway builds and deploys automatically

## Update Frontend to Use Service

Update your Next.js frontend to call the scraper service:

```typescript
// In your frontend component
const SCRAPER_SERVICE_URL = process.env.NEXT_PUBLIC_SCRAPER_URL || 'http://localhost:3000';

const response = await fetch(`${SCRAPER_SERVICE_URL}/api/fetch-product`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ url }),
});
```

Set environment variable in Vercel (or your frontend host):
```
NEXT_PUBLIC_SCRAPER_URL=https://your-scraper-service.onrender.com
```

## Health Check

After deployment, verify it's working:

```bash
curl https://your-service.onrender.com/health
# Should return: {"status":"ok","service":"wist-scraper-service"}
```

## Monitoring

- **Render**: Check logs in dashboard → Your Service → Logs
- **Fly.io**: `fly logs -a wist-scraper-service`
- **Railway**: View logs in dashboard

Monitor for:
- High error rates
- Block detection spikes (403 responses)
- Memory usage
- Response times

## Scaling

### When to Scale

- Memory usage consistently > 80%
- Response times > 10s
- High error rates

### Options

1. **Upgrade Plan**: More RAM on Render/Fly/Railway
2. **Multiple Instances**: Load balance across instances
3. **Redis Cache**: Replace in-memory cache for multi-instance
4. **Queue System**: Use BullMQ/Agenda for background jobs

## Troubleshooting

### Service Won't Start

- Check Dockerfile syntax
- Verify all dependencies in package.json
- Check Render/Fly logs for errors

### Chromium Fails

- Ensure Dockerfile includes all Chromium dependencies
- Verify `npx playwright install chromium --with-deps` ran during build

### High Memory

- Reduce cache TTL
- Implement cache size limits
- Scale to larger instance

### 403 Blocks Increasing

- Review stealth techniques
- Increase delays between requests
- Consider proxy rotation (if scaling)
- Check error analytics in Supabase `scrape_errors` table

## Error Analytics

Failed scrapes are automatically logged to Supabase `scrape_errors` table for analysis.

### Viewing Error Analytics

Run this SQL in Supabase SQL Editor:

```sql
-- Get blocked domains summary (last 7 days)
SELECT * FROM get_blocked_domains_summary(7);

-- Get recent errors by domain
SELECT 
  domain,
  error_type,
  COUNT(*) as error_count,
  MAX(failed_at) as last_error
FROM scrape_errors
WHERE failed_at >= NOW() - INTERVAL '7 days'
GROUP BY domain, error_type
ORDER BY error_count DESC;

-- Get blocked domains (high priority)
SELECT DISTINCT domain, COUNT(*) as block_count
FROM scrape_errors
WHERE error_type = 'blocked'
  AND failed_at >= NOW() - INTERVAL '7 days'
GROUP BY domain
ORDER BY block_count DESC;
```

This helps you:
- Identify which domains are blocking you most
- Track timeout/network issues
- Build a "blocked domain list" for manual improvement
