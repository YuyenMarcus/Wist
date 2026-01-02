# How to Update Extension ID After Reloading Extension

## ⚠️ Why This Happens

When you reload or remove/reinstall the Chrome extension, Chrome assigns it a **new Extension ID**. Your website (`ExtensionSync.tsx`) is still trying to send the auth token to the **old ID**, so the extension never receives it.

## 🔧 Quick Fix (3 Steps)

### Step 1: Get Your Current Extension ID

1. Open Chrome
2. Go to `chrome://extensions/`
3. Find **"Wist - Wishlist & Price Tracker"**
4. Look for the **ID** shown under the extension name
   - It looks like: `abcdefghijklmnopqrstuvwxyz123456`
   - It's a long string of letters and numbers
5. **Copy the entire ID**

### Step 2: Update ExtensionSync.tsx

1. Open `components/ExtensionSync.tsx` in your code editor
2. Find line 13:
   ```typescript
   const EXTENSION_ID = "hlgalligngcfiaibgkinhlkaniibjlmh";
   ```
3. Replace `"hlgalligngcfiaibgkinhlkaniibjlmh"` with your **NEW** extension ID
4. Save the file

### Step 3: Deploy and Test

1. **Commit and push:**
   ```bash
   git add components/ExtensionSync.tsx
   git commit -m "Update extension ID"
   git push origin main
   ```

2. **Wait for Vercel to deploy** (~1-2 minutes)

3. **Test the sync:**
   - Go to `wishlist.nuvio.cloud/dashboard`
   - Open browser console (F12)
   - Refresh the page
   - You should see: `✅ Wist Extension Synced!`

4. **Test saving:**
   - Go to an Amazon product page
   - Click extension icon
   - Click "Save to Wishlist"
   - Should work without "Not logged in" error

## ✅ Verification

After updating, check the browser console on your dashboard page. You should see:
```
🔄 Wist: Syncing token to extension...
✅ Wist Extension Synced!
```

If you see:
```
Extension not reachable: Could not establish connection...
```

Then the Extension ID is still wrong. Double-check that you copied the correct ID from `chrome://extensions/`.

## 🔄 Future: Making This Easier

To avoid this issue in the future, you could:
1. Use a **packed extension** (`.crx` file) - keeps the same ID
2. Add a **manual sync button** in the extension popup
3. Use **chrome.identity API** for OAuth flow (more complex)

For now, just remember: **Every time you reload the extension, update the Extension ID in ExtensionSync.tsx**

