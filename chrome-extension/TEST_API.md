# API Connectivity Test Guide

## Step 1: "Is It Down?" Test

**Open a new Chrome tab and visit:**
```
https://wishlist.nuvio.cloud/api/preview-link
```

### Expected Results:

**✅ Result A: Server is UP**
- You see: `{"error":"Method Not Allowed"}` or similar JSON
- **Meaning**: Server is running, but GET method not allowed (POST required)
- **Action**: Proceed to Step 2

**❌ Result B: Server is DOWN**
- You see: "This site can't be reached" or "DNS_PROBE_FINISHED_NXDOMAIN"
- **Meaning**: Server is not accessible or DNS is wrong
- **Action**: Check Vercel deployment status

---

## Step 2: Test POST Request in Browser

**Open Chrome DevTools (F12) → Console tab, then run:**

```javascript
fetch('https://wishlist.nuvio.cloud/api/preview-link', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ url: 'https://amazon.com/dp/B08N5WRWNW' })
})
.then(r => {
  console.log('✅ Status:', r.status);
  return r.json();
})
.then(data => {
  console.log('✅ Response:', data);
})
.catch(err => {
  console.error('❌ Error:', err);
});
```

### Expected Results:

**✅ Success**: You see status 200 and product data
- **Meaning**: API is working, issue is in extension
- **Action**: Proceed to Step 3

**❌ Failure**: You see network error
- **Meaning**: API is not accessible
- **Action**: Check Vercel deployment

---

## Step 3: Service Worker Console Diagnostic

**In Service Worker Console (chrome://extensions → Inspect views: service worker), run:**

```javascript
// Test 1: Verify API_BASE_URL
console.log("📍 API_BASE_URL:", "https://wishlist.nuvio.cloud");

// Test 2: Direct fetch test
fetch('https://wishlist.nuvio.cloud/api/preview-link', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ url: 'https://amazon.com/dp/B08N5WRWNW' })
})
.then(r => {
  console.log('✅ Service Worker Fetch Status:', r.status);
  return r.json();
})
.then(data => console.log('✅ Service Worker Response:', data))
.catch(err => {
  console.error('❌ Service Worker Error:', err);
  console.error('   Error name:', err.name);
  console.error('   Error message:', err.message);
});
```

### Look for these specific error codes:

- `ERR_CONNECTION_REFUSED` → Server not running
- `ERR_NAME_NOT_RESOLVED` → DNS issue
- `ERR_SSL_PROTOCOL_ERROR` → Certificate issue
- `ERR_BLOCKED_BY_CLIENT` → Extension/adblocker blocking
- `Both ports failed` → DNS/IPv6 issue

---

## Step 4: Verify Manifest Permissions

**Check `chrome-extension/manifest.json` has:**

```json
"host_permissions": [
  "https://wishlist.nuvio.cloud/*",
  "https://*.nuvio.cloud/*"
]
```

**After changing manifest.json:**
1. Go to `chrome://extensions/`
2. Click **Reload** on the extension
3. This applies new permissions

---

## Step 5: Check Extension Storage

**In Service Worker Console:**

```javascript
// Check if extension is using correct URL
chrome.storage.local.get(null, (items) => {
  console.log('Extension storage:', items);
});

// Check API_BASE_URL constant (if stored)
console.log('API_BASE_URL constant:', 'https://wishlist.nuvio.cloud');
```

---

## Quick Diagnostic Script

**Copy and paste this entire script into Service Worker Console:**

```javascript
(async function diagnose() {
  console.log("═══════════════════════════════════════");
  console.log("🔍 WIST EXTENSION DIAGNOSTICS");
  console.log("═══════════════════════════════════════");
  
  // Test 1: DNS Resolution
  console.log("\n1️⃣ Testing DNS resolution...");
  try {
    const response = await fetch('https://wishlist.nuvio.cloud', { method: 'HEAD' });
    console.log("✅ DNS resolved! Status:", response.status);
  } catch (err) {
    console.error("❌ DNS failed:", err.message);
    console.error("   This means the domain doesn't exist or isn't accessible");
    return;
  }
  
  // Test 2: API Endpoint
  console.log("\n2️⃣ Testing API endpoint...");
  try {
    const response = await fetch('https://wishlist.nuvio.cloud/api/preview-link', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: 'https://amazon.com/dp/B08N5WRWNW' })
    });
    console.log("✅ API responded! Status:", response.status);
    const data = await response.json();
    console.log("✅ Response data:", data);
  } catch (err) {
    console.error("❌ API failed:", err.name, err.message);
    console.error("   Full error:", err);
  }
  
  // Test 3: Extension Storage
  console.log("\n3️⃣ Checking extension storage...");
  chrome.storage.local.get(null, (items) => {
    console.log("Storage contents:", items);
  });
  
  console.log("\n═══════════════════════════════════════");
  console.log("✅ Diagnostics complete!");
  console.log("═══════════════════════════════════════");
})();
```

---

## Common Fixes

### If DNS fails:
- Check Vercel deployment is live
- Verify domain `wishlist.nuvio.cloud` is configured correctly
- Try accessing `https://wishlist.nuvio.cloud` in browser

### If API works in browser but not extension:
- Reload extension (chrome://extensions → Reload)
- Check manifest permissions match the URL
- Clear extension storage and reload

### If "Both ports failed":
- This is a DNS/IPv6 issue
- Try accessing the URL directly in browser first
- Check if your network blocks IPv6

