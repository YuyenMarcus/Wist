# Terminal Output Guide - What to Look For

## Service Started

When you run `python app.py`, you should see:

```
============================================================
Starting Wist Scraper Service...
Using crochet to manage Scrapy reactor
Service will be available at http://0.0.0.0:5000
============================================================
 * Running on http://0.0.0.0:5000
```

**Keep this terminal visible!** All the action happens here.

## When You Click "Fetch" in Frontend

Watch for one of these three patterns:

---

## Story A: The "Ninja" ✅

**Terminal Output**:
```
✅ Job abc123... found item: Sony WH-1000XM5 Wireless Noise Canceling...
✅ Job abc123...: Scrapy succeeded! Title: 'Sony WH-1000XM5 Wireless Noise Canceling...'
```

**Key Indicators**:
- ✅ Two success messages
- ✅ Product title appears (not "Amazon.com")
- ✅ No fallback message
- ✅ Fast (2-5 seconds)

**Verdict**: Scrapy's stealth worked! Fast and efficient.

---

## Story B: The "Tank" 🔄

**Terminal Output**:
```
✅ Job abc123... found item: Amazon.com
⚠️  Job abc123...: Scrapy detected captcha (title: 'Amazon.com'), trying Playwright fallback...
🔄 Job abc123...: Starting Playwright fallback...
[Playwright] Launching browser for https://www.amazon.com/dp/...
   [Playwright] Navigating to URL...
   [Playwright] Waiting 3.2s (human behavior)...
   [Playwright] Extracting product data...
   [Playwright] Extraction complete. Title: 'Sony WH-1000XM5 Wireless Noise Canceling...'
✅ Job abc123...: Playwright fallback succeeded! Title: Sony WH-1000XM5 Wireless Noise Canceling...
```

**Key Indicators**:
- ⚠️ Warning message about captcha
- 🔄 "Starting Playwright fallback" message
- [Playwright] Step-by-step progress
- ✅ Final success with product title

**Verdict**: System healed itself! Playwright saved the day.

---

## Story C: The "Fortress" ❌

**Terminal Output**:
```
✅ Job abc123... found item: Amazon.com
⚠️  Job abc123...: Scrapy detected captcha (title: 'Amazon.com'), trying Playwright fallback...
🔄 Job abc123...: Starting Playwright fallback...
[Playwright] Launching browser for https://www.amazon.com/dp/...
   [Playwright] Navigating to URL...
   [Playwright] Waiting 2.8s (human behavior)...
   [Playwright] Extracting product data...
   [Playwright] Extraction failed - no title found
❌ Job abc123...: Playwright also failed (title: 'None')
```

**OR**:
```
⚠️  Job abc123...: Scrapy detected captcha, trying Playwright fallback...
🔄 Job abc123...: Starting Playwright fallback...
❌ Job abc123...: Playwright crashed: [error details]
```

**Key Indicators**:
- ⚠️ Warning about captcha
- 🔄 Fallback triggered
- ❌ Final failure message
- No product data extracted

**Verdict**: Both methods blocked. Need proxy rotation.

---

## Quick Reference

| Story | First Message | Fallback? | Final Status | Time |
|-------|--------------|-----------|--------------|------|
| A (Ninja) | ✅ Scrapy found item | No | ✅ Success | 2-5s |
| B (Tank) | ✅ Scrapy found "Amazon.com" | Yes | ✅ Success | 5-15s |
| C (Fortress) | ✅ Scrapy found "Amazon.com" | Yes | ❌ Failed | 5-15s |

## Report Format

**Simply copy/paste the terminal output** or report:

```
"I got Story [A / B / C]"
```

Plus any error messages if Story C.



