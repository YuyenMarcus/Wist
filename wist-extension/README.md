# Wist Chrome Extension

Chrome extension for Wist that allows you to quickly add products to your wishlist from any retailer.

## Features

- 🎯 **One-Click Add**: Click the extension icon on any product page to add it to your wishlist
- 📦 **Product Preview**: See title, image, and price before saving
- 🎉 **Purchase Detection**: Automatically detects purchases (coming soon)
- 🔗 **API Integration**: Connects to your Wist Next.js API

## Installation (Development)

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable "Developer mode" (toggle in top right)
3. Click "Load unpacked"
4. Select the `chrome-extension` folder
5. The extension is now installed!

## Setup

### Development Mode

1. Make sure your Next.js app is running on `http://localhost:3000`
2. The extension is configured to use `http://localhost:3000/api/preview-link`
3. Click the extension icon on any product page
4. Preview will appear - click "Save to Wishlist" (TODO: implement save API call)

### Production Mode

1. Update `background.js` - change the `API_ENDPOINT` to:
   ```javascript
   const API_ENDPOINT = "https://wishlist.nuvio.cloud/api/preview-link";
   ```

2. Make sure your production API has CORS enabled for the extension

## File Structure

- `manifest.json` - Extension configuration and permissions
- `background.js` - Service worker that handles API calls (bypasses CORS)
- `popup.html/js` - Extension popup UI (shown when clicking icon)
- `content.js` - Injected scripts for purchase detection (separate feature)
- `styles.css` - Global styles
- `icons/` - Extension icons (icon16.png, icon48.png, icon128.png) - **TODO: Add these**

## API Endpoints Used

- `POST /api/preview-link` - Fetches product metadata (title, image, price) from a URL
- `POST /api/purchases` - Saves purchase to "Just Got It" feed (TODO)

## Next Steps

1. **Add Icon Files**: Create icon16.png, icon48.png, icon128.png in the `icons/` folder
2. **Implement Save API**: Update the "Save to Wishlist" button to call your save endpoint
3. **Add Authentication**: Store auth token and send with requests
4. **Production Deployment**: Update API_ENDPOINT in background.js

## Testing

1. Start your Next.js dev server: `npm run dev`
2. Load the extension in Chrome
3. Navigate to any product page (Amazon, Target, etc.)
4. Click the Wist extension icon
5. You should see a preview card with product details
