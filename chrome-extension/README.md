# Wist Chrome Extension

Chrome extension for Wist that detects purchases and allows users to add them to their "Just Got It" feed.

## Features

- 🎉 **Purchase Detection**: Automatically detects when you complete a purchase on supported retailers
- 📝 **Quick Post**: One-click posting to your "Just Got It" feed
- 🛍️ **Wishlist Integration**: Option to add purchases to wishlist instead

## Supported Retailers

- Amazon
- Target
- Etsy
- Shopify stores
- Best Buy
- Walmart

## Installation (Development)

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable "Developer mode" (toggle in top right)
3. Click "Load unpacked"
4. Select the `chrome-extension` folder
5. The extension is now installed!

## Setup

1. Click the extension icon
2. Click "Log in to Wist"
3. Authenticate with your Wist account
4. Start shopping! The extension will detect purchases automatically

## File Structure

- `manifest.json` - Extension configuration
- `background.js` - Service worker that monitors tabs
- `content.js` - Injected scripts that handle UI and scraping
- `popup.html/js` - Extension popup interface
- `styles.css` - Global styles

## Next Steps

1. Create placeholder icon files (icon16.png, icon48.png, icon128.png)
2. Add API endpoint at `/api/purchases` in Next.js app
3. Implement authentication flow for extension
4. Enhance product data extraction per retailer

