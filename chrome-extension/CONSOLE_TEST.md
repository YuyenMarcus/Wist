# How to Test in Service Worker Console

## Problem: Can't Paste in DevTools Console

### Solution 1: Enable Paste in DevTools

1. Open Service Worker console (`chrome://extensions/` → "Inspect views: service worker")
2. Right-click in the console area
3. Look for "Paste" option or use **Ctrl+V** (Windows) / **Cmd+V** (Mac)
4. If that doesn't work, try clicking the console input area first, then paste

### Solution 2: Use the Built-in Test Function

**The extension now has a built-in test function!**

1. Open Service Worker console
2. Type: `testAPI()`
3. Press Enter
4. It will automatically test the API connection and show results

### Solution 3: Type Manually (Short Version)

Type these commands one at a time:

```javascript
fetch('https://wishlist.nuvio.cloud/api/preview-link', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({url:'https://amazon.com/dp/B08N5WRWNW'})}).then(r=>r.json()).then(console.log).catch(console.error)
```

### Solution 4: Use Sources Tab

1. Open Service Worker console
2. Click **Sources** tab
3. Find `background.js` in the file tree
4. Add a breakpoint or add `debugger;` statement
5. You can edit the file directly there

### Solution 5: Check Network Tab

1. Open Service Worker console
2. Click **Network** tab
3. Use the extension (click icon on product page)
4. Look for the request to `preview-link`
5. Click it to see the full error details

## Quick Manual Test Commands

**Type these one line at a time:**

```javascript
console.log("Testing...")
```

```javascript
fetch('https://wishlist.nuvio.cloud')
```

```javascript
fetch('https://wishlist.nuvio.cloud/api/preview-link', {method:'POST',headers:{'Content-Type':'application/json'},body:'{"url":"https://amazon.com/dp/B08N5WRWNW"}'}).then(r=>{console.log('Status:',r.status);return r.json()}).then(console.log).catch(e=>console.error('Error:',e))
```

## What to Look For

After running `testAPI()` or the fetch command, check for:

- ✅ **Status: 200** → API is working!
- ❌ **ERR_CONNECTION_REFUSED** → Server not running
- ❌ **ERR_NAME_NOT_RESOLVED** → DNS issue
- ❌ **ERR_SSL_PROTOCOL_ERROR** → Certificate issue
- ❌ **Both ports failed** → DNS/IPv6 issue

