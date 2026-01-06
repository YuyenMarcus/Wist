# ✅ Post-Deployment Monitoring Checklist

After deploying the egress optimizations, use this checklist to verify everything is working correctly.

---

## Day 1: Immediate Verification

### 1. ✅ Verify Deployments
- [ ] Code deployed to Vercel successfully
- [ ] No build errors
- [ ] Environment variables set correctly
- [ ] Test manual price check from dashboard

### 2. ✅ Test Key Features
- [ ] Dashboard loads user items (should be limited to 100)
- [ ] Item detail page loads price history (should be limited to 100 entries)
- [ ] Manual price check works (should process in batches)
- [ ] Rate limiting works (try running price check twice quickly)

### 3. ✅ Check Supabase Logs
- [ ] Go to **Dashboard → Logs → API Logs**
- [ ] Filter by `/rest/v1/items` endpoint
- [ ] Check response sizes (should be < 500 KB per request)
- [ ] Check for any errors

---

## Day 2-3: Monitor Usage

### 1. ✅ Check Egress Trends
- [ ] Go to **Settings → Usage**
- [ ] Check **Database Egress** graph
- [ ] Compare last 24 hours vs. previous period
- [ ] **Expected**: 60-80% reduction in egress

### 2. ✅ Run Monitoring Queries
- [ ] Run `supabase-monitoring-queries.sql` in SQL Editor
- [ ] Check total active items count
- [ ] Check users with > 100 items (may need limit increase)
- [ ] Check price history sizes

### 3. ✅ Review API Logs
- [ ] Check which endpoints have most traffic
- [ ] Verify response sizes are reasonable (< 1 MB)
- [ ] Check for slow queries (> 1 second)

---

## Week 1: Deep Analysis

### 1. ✅ Analyze User Patterns
- [ ] How many users have > 100 items?
- [ ] Average items per user?
- [ ] Are users hitting the 100-item limit?

**If users have > 100 items:**
- Consider increasing limit to 200-300
- Or implement frontend pagination (Load More button)

### 2. ✅ Analyze Cron Job Performance
- [ ] How many items does cron job process per run?
- [ ] Does it hit the 200-item limit?
- [ ] How long does each run take?

**If hitting 200-item limit:**
- Consider increasing `MAX_ITEMS_TO_CHECK` to 300-500
- Or schedule more frequent runs (twice daily)

**If timing out:**
- Reduce `MAX_ITEMS_TO_CHECK` to 100
- Or increase Vercel function timeout (paid plan)

### 3. ✅ Check Price History Retention
- [ ] Are users seeing enough history (90 days)?
- [ ] Is 100-entry limit sufficient?

**If users need more history:**
- Increase limit to 200 entries
- Or increase time window to 180 days

---

## Monthly Review

### 1. ✅ Review Egress Trends
- [ ] Is egress staying under 5 GB/day?
- [ ] Any unusual spikes?
- [ ] Trend increasing or stable?

### 2. ✅ Review Limits
- [ ] Are current limits appropriate?
- [ ] Any users complaining about missing data?
- [ ] Any performance issues?

### 3. ✅ Optimize Further
- [ ] Check for new optimization opportunities
- [ ] Review slow queries
- [ ] Consider caching strategies

---

## Troubleshooting

### Issue: Egress Still High

**Check:**
1. Are there other endpoints fetching large data?
2. Is cron job running more frequently than expected?
3. Are users uploading large files to Storage?

**Fix:**
- Check API logs for high-traffic endpoints
- Review cron job schedule
- Check Storage bucket sizes

### Issue: Users Missing Items

**Check:**
1. How many items do affected users have?
2. Are they hitting the 100-item limit?

**Fix:**
- Increase limit to 200-300
- Implement frontend pagination
- Add "Load More" button

### Issue: Cron Job Timing Out

**Check:**
1. How many items is it trying to process?
2. Is it hitting the 200-item limit?

**Fix:**
- Reduce `MAX_ITEMS_TO_CHECK` to 100
- Increase batch size to 100 (process faster)
- Increase Vercel function timeout

### Issue: Price History Too Short

**Check:**
1. Are users complaining about missing history?
2. How many entries do items typically have?

**Fix:**
- Increase limit to 200 entries
- Increase time window to 180 days
- Consider weekly aggregation for older data

---

## Success Metrics

### Target Improvements
- ✅ **Egress reduction**: 60-80% decrease
- ✅ **Response sizes**: < 500 KB per request
- ✅ **Query times**: < 500ms for user queries
- ✅ **Cron job**: Completes in < 5 minutes

### Monitoring Queries

Run these weekly to track progress:

```sql
-- Check egress trends (compare week-over-week)
-- Go to Dashboard → Settings → Usage → Database Egress

-- Check item counts
SELECT COUNT(*) FROM items WHERE status = 'active';

-- Check price history growth
SELECT COUNT(*) FROM price_history 
WHERE created_at > NOW() - INTERVAL '7 days';
```

---

## Next Steps

1. ✅ **Deploy optimizations** (if not already done)
2. ✅ **Monitor for 1 week** using this checklist
3. ✅ **Adjust limits** based on actual usage
4. ✅ **Document findings** for future reference

---

## Notes

- **Pagination limits**: Currently 100 items per query
  - Increase if users commonly have > 100 items
  - Decrease if you want stricter limits
  
- **Cron batch size**: Currently 50 items per batch, 200 max per run
  - Increase if you have many active items
  - Decrease if you want faster runs

- **Price history**: Currently 100 entries or 90 days
  - Increase if users want longer history
  - Decrease if you want to save more storage

- **Rate limiting**: Currently 1 hour between runs
  - Increase if you want stricter limits
  - Decrease if you need more frequent checks

