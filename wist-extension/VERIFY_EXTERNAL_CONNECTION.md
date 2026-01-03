# Verify External Connection is Working

## ✅ Files Are Correct

Both files have been updated:
- ✅ `manifest.json` has `externally_connectable` with correct URLs
- ✅ `background.js` has external listener

## 🔄 CRITICAL: Reload Extension After Manifest Changes

**Manifest changes require a full reload!**

1. Go to `chrome://extensions/`
2. Find "Wist - Wishlist & Price Tracker"
3. Click the **Reload icon** 🔄 (circular arrow)
4. **Wait for it to fully reload**

## 🧪 Test External Connection

### Step 1: Open Service Worker Console

1. Go to `chrome://extensions/`
2. Find "Wist"
3. Click **"Inspect views: service worker"**
4. Keep this console open

### Step 2: Clear Storage (Fresh Test)

In Service Worker console, run:
```javascript
chrome.storage.local.clear(() => console.log("✅ Storage cleared"))
```

Verify it's empty:
```javascript
chrome.storage.local.get(null, console.log)
```
Should show: `{}`

### Step 3: Test from Website

1. **Open a NEW tab** (keep Service Worker console open)
2. Go to `https://wishlist.nuvio.cloud/dashboard`
3. **Open browser console** (F12) - NOT Service Worker console
4. **Refresh the page** (F5)

### Step 4: Check Both Consoles

**Browser Console** (F12 on dashboard):
- Should see: `🔄 Wist: Sync Attempt 1/3...`
- Should see: `✅ Wist Extension Synced!`

**Service Worker Console** (chrome://extensions):
- Should see: `📡 WIST: Received External Message: {action: "SYNC_TOKEN", ...}`
- Should see: `✅ WIST: Auth Token Synced from Website!`

### Step 5: Verify Token in Storage

In Service Worker console:
```javascript
chrome.storage.local.get(null, console.log)
```

Should show: `{wist_auth_token: "eyJhbGci..."}`

---

## 🐛 Troubleshooting

### If you see NO logs in Service Worker console:

**Problem**: Extension isn't receiving messages from website

**Possible Causes**:
1. ❌ Extension not reloaded after manifest change
2. ❌ Wrong extension ID in ExtensionSync.tsx
3. ❌ Website URL doesn't match manifest pattern

**Fix**:
1. Reload extension (Step 2 above)
2. Verify Extension ID matches in `components/ExtensionSync.tsx`
3. Check that you're on `wishlist.nuvio.cloud` (not a different domain)

### If you see "Could not establish connection" in browser console:

**Problem**: Extension ID mismatch

**Fix**:
1. Go to `chrome://extensions/`
2. Copy the Extension ID
3. Update `components/ExtensionSync.tsx` line 13:
   ```typescript
   const EXTENSION_ID = "YOUR_ACTUAL_ID_HERE";
   ```
4. Deploy and refresh dashboard

### If you see logs but token doesn't appear:

**Problem**: Storage write failed

**Fix**:
- Check Service Worker console for errors
- Try reloading extension again
- Check if storage permissions are enabled

---

## ✅ Success Indicators

You'll know it's working when you see:

1. **Browser Console** (dashboard):
   ```
   🔄 Wist: Sync Attempt 1/3...
   ✅ Wist Extension Synced!
   ```

2. **Service Worker Console**:
   ```
   📡 WIST: Received External Message: {action: "SYNC_TOKEN", token: "..."}
   ✅ WIST: Auth Token Synced from Website!
   ```

3. **Storage Check**:
   ```javascript
   chrome.storage.local.get(null, console.log)
   // Shows: {wist_auth_token: "eyJhbGci..."}
   ```

---

## 📝 Notes

- **Manifest changes require reload** - Always reload extension after changing manifest.json
- **Check both consoles** - Browser console shows website side, Service Worker shows extension side
- **Extension ID must match** - Check `chrome://extensions/` and update ExtensionSync.tsx if needed

