# Smoke Test - Ready to Execute

## Critical Fix Applied ✅

**Problem**: Scrapy items weren't being captured - spider ran but data was lost.

**Solution**: Implemented callback mechanism:
- Spider accepts `on_item_scraped` callback function
- When data is found, spider calls callback immediately
- Callback stores data in `SCRAPED_ITEMS[job_id]` global dict
- Flask retrieves data from dict when spider completes

## Data Flow (Fixed)

```
Spider finds data
    ↓
Calls on_item_scraped(item) callback
    ↓
Callback stores in SCRAPED_ITEMS[job_id]
    ↓
Spider completes → on_success() callback
    ↓
Flask retrieves from SCRAPED_ITEMS[job_id]
    ↓
Stores in JOBS[job_id]["data"]
    ↓
API returns to frontend
```

## Execute Smoke Test

### Step 1: Restart Python Service

**Terminal 1**:
```bash
cd scraper-service
# Press CTRL+C if running, then:
python app.py
```

**Expected Output**:
```
============================================================
Starting Wist Scraper Service...
Using crochet to manage Scrapy reactor
Service will be available at http://0.0.0.0:5000
============================================================
 * Running on http://0.0.0.0:5000
```

### Step 2: Test in Browser

1. Open `http://localhost:3000`
2. Open DevTools → **Network Tab**
3. Paste Amazon URL (e.g., `https://www.amazon.com/dp/B08N5WRWNW`)
4. Click "Fetch"
5. Watch for:
   - `POST /api/fetch-product-async` → Returns `job_id`
   - Multiple `GET /api/job-status/<job_id>` requests
   - Final response with `status: "completed"`

### Step 3: Check Python Console

You should see:
```
✅ Job <job_id> found item: Sony WH-1000XM5 Wireless Noise...
```

This confirms the callback is working!

### Step 4: Check Network Response

Find the final `GET /api/job-status/<job_id>` that returns `status: "completed"`.

**Click on it → Response tab → Check JSON**

## Expected Results

### Result A: Success ✅

```json
{
  "success": true,
  "job_id": "uuid-here",
  "status": "completed",
  "result": {
    "title": "Sony WH-1000XM5 Wireless Noise Canceling Headphones...",
    "price": 348.00,
    "priceRaw": "$348.00",
    "currency": "USD",
    "image": "https://m.media-amazon.com/images/I/...",
    "description": "...",
    "url": "https://www.amazon.com/dp/..."
  }
}
```

**Indicators**:
- ✅ `status: "completed"`
- ✅ `result.title` contains actual product name
- ✅ `result.price` is a number (not null)
- ✅ Python console shows "✅ Job found item"

**Next Step**: Proceed to **Data Persistence** (Sprint 2)

---

### Result B: Captcha Trap ❌

```json
{
  "success": true,
  "job_id": "uuid-here",
  "status": "failed",
  "error": "Captcha/robot check detected. Site is blocking automated access."
}
```

**OR**:

```json
{
  "status": "completed",
  "result": {
    "title": "Amazon.com",
    "price": null,
    "image": null
  }
}
```

**Indicators**:
- ❌ `status: "failed"` with captcha error
- ❌ OR `result.title` is just "Amazon.com"
- ❌ `result.price` is null

**Next Step**: Tune **Stealth Settings** (see `STEALTH_TUNING_GUIDE.md`)

---

### Result C: Data Null / Internal Error ❌

```json
{
  "status": "completed",
  "result": null
}
```

**OR**:

```json
{
  "status": "failed",
  "error": "No data extracted - spider completed but no item found"
}
```

**Possible Causes**:
1. Callback not being called (check Python console for "✅ Job found item")
2. Spider not finding data (check selectors)
3. URL format issue

**Debug Steps**:
1. Check Python console for errors
2. Verify URL is accessible
3. Check if callback is being called (look for "✅ Job found item" message)
4. Verify spider selectors match current Amazon HTML structure

## Verification Checklist

- [ ] Python service restarted
- [ ] Service shows "Running on http://0.0.0.0:5000"
- [ ] Pasted Amazon URL in frontend
- [ ] Network tab shows job creation and polling
- [ ] Python console shows "✅ Job found item" message
- [ ] Final response contains product data (Result A) OR error (Result B/C)

## Report Your Result

Please report which result you got:
- **Result A**: Success - proceed to data persistence
- **Result B**: Captcha trap - tune stealth settings
- **Result C**: Data null - debug callback wiring



