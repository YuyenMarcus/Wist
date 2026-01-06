# 📊 How to Check Supabase Logs for Traffic Analysis

## Quick Access

1. **Go to**: https://supabase.com/dashboard
2. **Select your project**
3. **Click "Logs"** in the left sidebar

---

## Types of Logs

### 1. API Logs
**Location:** Logs → API Logs

**What it shows:**
- All API requests to your Supabase project
- Request paths (e.g., `/rest/v1/items`)
- Request methods (GET, POST, etc.)
- Response status codes
- Response times
- Request/response sizes

**What to look for:**
- ✅ **High frequency endpoints**: Which endpoints are called most?
- ✅ **Large responses**: Which endpoints return the most data?
- ✅ **Slow queries**: Which endpoints take > 1 second?
- ✅ **Error rates**: Which endpoints fail frequently?

### 2. Database Logs
**Location:** Logs → Database Logs

**What it shows:**
- SQL queries executed
- Query execution time
- Query frequency
- Database errors

**What to look for:**
- ✅ **Slow queries**: Queries taking > 500ms
- ✅ **Frequent queries**: Queries running many times per minute
- ✅ **Large result sets**: Queries returning many rows
- ✅ **Full table scans**: Queries without proper indexes

### 3. Auth Logs
**Location:** Logs → Auth Logs

**What it shows:**
- User signups
- User logins
- Token refreshes
- Auth errors

**What to look for:**
- ✅ **High login frequency**: Users logging in repeatedly
- ✅ **Failed logins**: Potential security issues
- ✅ **Token refresh patterns**: Unusual refresh patterns

---

## How to Analyze Traffic

### Step 1: Check API Request Counts

1. Go to **Logs → API Logs**
2. Filter by time range (last 24 hours, last week, etc.)
3. Look for endpoints with high request counts

**Example:**
```
/rest/v1/items?select=*     → 1,234 requests (HIGH!)
/rest/v1/products?select=*  → 567 requests
/rest/v1/price_history      → 89 requests
```

**Action:** If `/rest/v1/items` has high traffic, check if pagination is working.

### Step 2: Check Response Sizes

1. In API Logs, look at response sizes
2. Identify endpoints returning large responses

**Example:**
```
/rest/v1/items?select=*     → Avg 2.5 MB per response (TOO LARGE!)
/rest/v1/products?select=*  → Avg 500 KB per response
```

**Action:** If responses are > 1 MB, you need pagination or column selection.

### Step 3: Check Query Performance

1. Go to **Logs → Database Logs**
2. Filter by execution time (show queries > 500ms)
3. Look for slow queries

**Example:**
```
SELECT * FROM items WHERE user_id = '...'  → 2.3 seconds (SLOW!)
SELECT id, title FROM items WHERE user_id = '...' LIMIT 100  → 45ms (GOOD)
```

**Action:** If queries are slow, check indexes and add limits.

### Step 4: Check Egress Usage

1. Go to **Settings → Usage**
2. Check **Database Egress** (data transferred out)
3. Check trends over time

**What to look for:**
- ✅ **Daily egress**: Should be < 5 GB/day on free tier
- ✅ **Trends**: Is it increasing or stable?
- ✅ **Spikes**: Any unusual spikes in usage?

---

## Common Issues to Look For

### Issue 1: Fetching All Items Without Pagination

**Symptoms:**
- High request count to `/rest/v1/items?select=*`
- Large response sizes (> 1 MB)
- Slow query times (> 1 second)

**Fix:** ✅ Already implemented pagination (100 item limit)

### Issue 2: Using `select('*')` Instead of Specific Columns

**Symptoms:**
- Large response sizes even with pagination
- Unnecessary data in responses

**Fix:** ✅ Already optimized column selection

### Issue 3: Cron Job Running Too Frequently

**Symptoms:**
- High request count to cron endpoints
- Consistent spikes every hour/day

**Fix:** 
- Check `vercel.json` for cron schedule
- Currently: `check-prices` is manual, `cleanup` is weekly ✅

### Issue 4: Price History Growing Unbounded

**Symptoms:**
- Large responses from `/rest/v1/price_history`
- Slow queries on price history

**Fix:** ✅ Already limited to 100 entries or 90 days

---

## Monitoring Checklist

### Daily (Quick Check)
- [ ] Check API request count (should be reasonable)
- [ ] Check for any error spikes
- [ ] Check egress usage (should be < 5 GB/day)

### Weekly (Detailed Review)
- [ ] Review slow queries (> 500ms)
- [ ] Review high-traffic endpoints
- [ ] Review response sizes (should be < 1 MB)
- [ ] Check egress trends

### Monthly (Deep Analysis)
- [ ] Review user item counts (if > 100, consider increasing limit)
- [ ] Review cron job performance
- [ ] Review price history retention policy
- [ ] Check for optimization opportunities

---

## Example Log Analysis

### Good Pattern ✅
```
API Logs (Last 24 hours):
- /rest/v1/items?select=id,title,url&limit=100  → 234 requests, avg 50 KB
- /rest/v1/price_history?limit=100             → 89 requests, avg 20 KB
- Database egress: 2.3 GB (well under 5 GB limit)
```

### Bad Pattern ❌
```
API Logs (Last 24 hours):
- /rest/v1/items?select=*                       → 1,234 requests, avg 2.5 MB
- /rest/v1/price_history                        → 567 requests, avg 500 KB
- Database egress: 8.7 GB (OVER LIMIT!)
```

---

## Tools for Analysis

### Supabase Dashboard
- **Built-in logs**: Good for quick checks
- **Usage dashboard**: Shows egress trends
- **Query performance**: Shows slow queries

### External Tools (Optional)
- **PostgreSQL logs**: More detailed query analysis
- **APM tools**: Application performance monitoring
- **Custom dashboards**: Build your own analytics

---

## Quick Wins

1. ✅ **Check logs daily** for the first week after deployment
2. ✅ **Monitor egress** to ensure it's decreasing
3. ✅ **Review slow queries** and optimize them
4. ✅ **Adjust limits** based on actual usage patterns

---

## Need Help?

If you see:
- **High egress**: Check for `select('*')` queries without limits
- **Slow queries**: Check indexes and add limits
- **High request counts**: Check cron job frequency
- **Large responses**: Check pagination and column selection

All of these have been optimized in the recent changes! 🎉

