# Manual Token Sync Script

If the automatic token sync isn't working, use this script to manually sync your auth token to the extension.

## 🚀 Quick Fix (Copy/Paste This)

1. **Go to your dashboard**: `https://wishlist.nuvio.cloud/dashboard`
2. **Open Console** (F12)
3. **Copy and paste this entire script**:

```javascript
// Manual Token Sync Script
(async () => {
  const EXTENSION_ID = "hlgalligngcfiaibgkinhlkaniibjlmh"; // ✅ Current Extension ID
  
  try {
    // Method 1: Use Supabase client (if available in window)
    let token = null;
    
    if (window.supabase) {
      const { data: { session } } = await window.supabase.auth.getSession();
      token = session?.access_token;
    } else {
      // Method 2: Try to get from localStorage
      // Supabase stores session in localStorage with key pattern: sb-{project-ref}-auth-token
      const storageKeys = Object.keys(localStorage).filter(k => k.includes('auth-token'));
      if (storageKeys.length > 0) {
        const rawData = localStorage.getItem(storageKeys[0]);
        if (rawData) {
          const session = JSON.parse(rawData);
          token = session?.access_token || session?.currentSession?.access_token;
        }
      }
    }
    
    if (!token) {
      console.error("❌ Could not find auth token. Are you logged in?");
      return;
    }
    
    console.log("🔑 Found Token:", token.substring(0, 20) + "...");
    
    // Send token to extension
    chrome.runtime.sendMessage(
      EXTENSION_ID,
      { 
        action: "SYNC_TOKEN",  // ✅ Must match background.js listener
        token: token 
      },
      (response) => {
        if (chrome.runtime.lastError) {
          console.error("❌ Chrome Error:", chrome.runtime.lastError.message);
          console.error("   Extension ID might be wrong. Check chrome://extensions/");
        } else if (response?.success) {
          console.log("✅ Token synced successfully!");
          console.log("   You can now save items from the extension.");
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

4. **Press Enter**
5. **Check the console output**:
   - ✅ `Token synced successfully!` = It worked!
   - ❌ `Chrome Error: Could not establish connection` = Extension ID is wrong
   - ❌ `Could not find auth token` = You're not logged in

## 🔍 Troubleshooting

### If you see "Could not establish connection":
1. Go to `chrome://extensions/`
2. Find "Wist - Wishlist & Price Tracker"
3. Copy the ID shown under the extension name
4. Replace `EXTENSION_ID` in the script above
5. Run the script again

### If you see "Could not find auth token":
1. Make sure you're logged into the Wist dashboard
2. Refresh the page
3. Try the script again

### If nothing happens:
1. Check that the extension is installed and enabled
2. Check that you're on the correct domain (`wishlist.nuvio.cloud`)
3. Try reloading the extension in `chrome://extensions/`

## ✅ Verification

After running the script successfully:
1. Go to an Amazon product page
2. Click the extension icon
3. Click "Save to Wishlist"
4. Should work without "Not logged in" error!

