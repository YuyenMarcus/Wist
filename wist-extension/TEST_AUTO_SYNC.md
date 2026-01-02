# Test Automatic Sync - Verify It's Working

## 🧪 Quick Test to Verify Automatic Sync

### Step 1: Clear Extension Storage (Remove Token)

1. Go to `chrome://extensions/`
2. Find "Wist - Wishlist & Price Tracker"
3. Click **"Inspect views: service worker"**
4. In the Console, type:
   ```javascript
   chrome.storage.local.clear(() => console.log("✅ Storage cleared"))
   ```
5. Press Enter
6. Verify it's empty:
   ```javascript
   chrome.storage.local.get(null, console.log)
   ```
   Should show: `{}` (empty)

### Step 2: Test Automatic Sync

1. **Close the Service Worker console** (or minimize it)
2. Go to `https://wishlist.nuvio.cloud/dashboard`
3. **Open the browser console** (F12) - NOT the Service Worker console
4. **Refresh the page** (F5)
5. **Watch for these messages**:
   ```
   🔄 Wist: Syncing token to extension...
   ✅ Wist Extension Synced!
   ```

### Step 3: Verify Token Was Synced

1. Go back to `chrome://extensions/`
2. Click **"Inspect views: service worker"** again
3. In the Console, type:
   ```javascript
   chrome.storage.local.get(null, console.log)
   ```
4. Press Enter

**Expected Result**:
- ✅ `{wist_auth_token: "eyJhbGci..."}` = **Automatic sync is working!**
- ❌ `{}` (empty) = Automatic sync failed, need to investigate

### Step 4: Test Save Functionality

1. Go to an Amazon product page
2. Click extension icon
3. Click "Save to Wishlist"
4. Should work without "Not logged in" error

---

## 🔍 What to Look For

### If Automatic Sync Works:
- You'll see `🔄 Wist: Syncing token to extension...` in browser console
- Followed by `✅ Wist Extension Synced!`
- Token appears in Service Worker storage
- Save functionality works

### If Automatic Sync Fails:
- You might see `⚠️ Wist: Extension not reachable: ...`
- Or no messages at all
- Token doesn't appear in storage
- You'll need to use manual sync script

---

## 📝 Notes

- **The 500ms delay** ensures the extension is ready before sync
- **Retry logic** will attempt 2 more times if connection fails
- **Check browser console** (F12) not Service Worker console for sync messages
- If automatic sync fails, the manual sync script will always work as a backup

---

## ✅ Expected Behavior

After clearing storage and refreshing dashboard:
1. Browser console shows sync messages
2. Service Worker storage shows token
3. Save functionality works without manual intervention

**If all 3 happen**: Automatic sync is working! 🎉

