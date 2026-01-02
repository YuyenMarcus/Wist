# Token Sync Diagnostics

## 🔍 Step 1: Check if Token is in Extension Storage

1. Go to `chrome://extensions/`
2. Find "Wist - Wishlist & Price Tracker"
3. Click **"Inspect views: service worker"**
4. In the Console, type:
   ```javascript
   chrome.storage.local.get(null, console.log)
   ```
5. Press Enter

### Results:

**Result A: `{}` (Empty Object)**
- ❌ **Verdict**: Token sync failed. Extension storage is empty.
- **Fix**: Use manual sync script below

**Result B: `{wist_auth_token: "eyJhbGci..."}`**
- ✅ **Verdict**: Token is present!
- **Next**: Check if token is expired or API is rejecting it

---

## 🔧 Step 2: Manual Token Sync (If Storage is Empty)

### On Your Dashboard (`wishlist.nuvio.cloud/dashboard`)

1. Open Console (F12)
2. Look for: `🔄 Wist: Syncing token to extension...` and `✅ Wist Extension Synced!`

**If you DON'T see those messages**, the ExtensionSync component isn't running. Use this manual script:

```javascript
(async () => {
  const EXTENSION_ID = "hlgalligngcfiaibgkinhlkaniibjlmh"; // ✅ Current ID
  
  try {
    // Get token from localStorage
    const storageKeys = Object.keys(localStorage).filter(k => k.includes('auth-token'));
    if (storageKeys.length === 0) {
      console.error("❌ Not logged in. Please log in first.");
      return;
    }
    
    const rawData = localStorage.getItem(storageKeys[0]);
    const session = JSON.parse(rawData);
    const token = session?.access_token || session?.currentSession?.access_token;
    
    if (!token) {
      console.error("❌ Could not find token in session.");
      return;
    }
    
    console.log("🔑 Found Token:", token.substring(0, 20) + "...");
    
    // Send to extension
    chrome.runtime.sendMessage(
      EXTENSION_ID,
      { action: "SYNC_TOKEN", token: token },
      (response) => {
        if (chrome.runtime.lastError) {
          console.error("❌ Chrome Error:", chrome.runtime.lastError.message);
          console.error("   Extension ID might be wrong. Check chrome://extensions/");
        } else if (response?.success) {
          console.log("✅ Token synced successfully!");
          console.log("   Verify in Service Worker console:");
          console.log("   chrome.storage.local.get(null, console.log)");
        } else {
          console.error("❌ Sync failed:", response);
        }
      }
    );
  } catch (error) {
    console.error("❌ Error:", error);
  }
})();
```

3. **Verify it worked**: Go back to Service Worker console and run:
   ```javascript
   chrome.storage.local.get(null, console.log)
   ```
   Should now show: `{wist_auth_token: "..."}`

---

## ✅ Step 3: Test Save Functionality

After token is synced:

1. Go to an Amazon product page
2. Click extension icon
3. Should see product preview (title, price, image)
4. Click "Save to Wishlist"
5. Should work without "Not logged in" error

---

## 🐛 Troubleshooting

### "Could not establish connection"
- Extension ID is wrong
- Go to `chrome://extensions/` and copy the correct ID
- Update `EXTENSION_ID` in the script above

### "Not logged in" error persists
- Token might be expired
- Log out and log back into Wist dashboard
- Run manual sync script again

### Extension shows "Price: 0" or "Title: Amazon.com"
- Amazon is blocking server-side scraping
- ✅ **Fixed**: Extension now uses client-side scraping (reads directly from page)
- Reload extension and try again

---

## 📝 Notes

- Extension ID changes when you reload the extension
- Always update `EXTENSION_ID` in `components/ExtensionSync.tsx` after reloading
- Token persists in extension storage until you reload extension
- Client-side scraping bypasses Amazon bot detection completely

