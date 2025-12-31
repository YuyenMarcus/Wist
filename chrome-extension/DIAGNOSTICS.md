# Extension Diagnostics Guide

## How to Debug "Both Ports Failed" Error

### Step 1: Check Service Worker Console

1. Go to `chrome://extensions/`
2. Find "Wist - Wishlist & Price Tracker"
3. Click **"Inspect views: service worker"** (or "background page")
4. This opens the **Service Worker Console** - this is where the real errors appear

### Step 2: Look for Diagnostic Logs

When you use the extension, you should see logs like:

```
═══════════════════════════════════════
🔗 WIST EXTENSION: Starting Preview Request
📍 API URL: https://wishlist.nuvio.cloud/api/preview-link
📦 Product URL: https://amazon.com/...
═══════════════════════════════════════
```

### Step 3: Common Error Patterns

#### ERR_CONNECTION_REFUSED
- **Meaning**: Server is not running or not accessible
- **Fix**: Check if `https://wishlist.nuvio.cloud` loads in your browser

#### ERR_NAME_NOT_RESOLVED
- **Meaning**: DNS lookup failed
- **Fix**: Check your internet connection

#### ERR_SSL_PROTOCOL_ERROR
- **Meaning**: SSL certificate issue
- **Fix**: Check if the site loads in browser (might be certificate problem)

#### Both ports failed
- **Meaning**: Chrome couldn't establish connection
- **Fix**: Usually means server is down or URL is wrong

### Step 4: Test API Endpoint Directly

In the Service Worker Console, run:

```javascript
// Test if API is reachable
fetch('https://wishlist.nuvio.cloud/api/preview-link', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ url: 'https://amazon.com/dp/B08N5WRWNW' })
})
.then(r => {
  console.log('Status:', r.status);
  return r.json();
})
.then(data => console.log('Response:', data))
.catch(err => console.error('Error:', err));
```

### Step 5: Verify Manifest Permissions

Check `manifest.json` has:
```json
"host_permissions": [
  "https://wishlist.nuvio.cloud/*",
  "https://*.nuvio.cloud/*"
]
```

### Step 6: Check API_BASE_URL

In `background.js`, verify:
```javascript
const API_BASE_URL = "https://wishlist.nuvio.cloud";
```

**For local development**, change to:
```javascript
const API_BASE_URL = "http://localhost:3000";
```

## Quick Checklist

- [ ] Service Worker console shows detailed logs
- [ ] API URL matches manifest permissions
- [ ] API endpoint is accessible in browser
- [ ] Extension reloaded after manifest changes
- [ ] No firewall/proxy blocking requests

