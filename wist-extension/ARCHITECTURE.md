# Wist Chrome Extension - Complete Architecture Documentation

## 📋 Table of Contents
1. [Overview](#overview)
2. [File Structure](#file-structure)
3. [Architecture Components](#architecture-components)
4. [Data Flow](#data-flow)
5. [Message Passing System](#message-passing-system)
6. [Authentication Flow](#authentication-flow)
7. [API Integration](#api-integration)
8. [UI Components](#ui-components)
9. [Error Handling](#error-handling)

---

## 🎯 Overview

The Wist Chrome Extension is a **Manifest V3** extension that allows users to:
- **Preview products** from any e-commerce site (Amazon, Target, Etsy, etc.)
- **Save items to their wishlist** directly from product pages
- **Track purchases** with the "Just Got It" feature

### Key Technologies
- **Manifest V3** (Chrome Extension API)
- **Service Worker** (background.js) for API calls
- **Content Scripts** (content.js) for page interaction
- **Popup UI** (popup.html/js) for user interface
- **Chrome Storage API** for token persistence
- **Message Passing** for component communication

---

## 📁 File Structure

```
wist-extension/
├── manifest.json          # Extension configuration
├── background.js          # Service Worker (API bridge)
├── popup.html             # Popup UI structure
├── popup.js               # Popup logic & user interaction
├── content.js             # Content script (page injection)
├── styles.css             # Global styles
└── icons/                 # Extension icons (16x16 to 128x128)
    ├── icon16.png
    ├── icon32.png
    ├── icon48.png
    ├── icon64.png
    ├── icon96.png
    └── icon128.png
```

---

## 🏗️ Architecture Components

### 1. **manifest.json** - Extension Configuration

**Purpose**: Defines the extension's permissions, structure, and behavior.

**Key Sections**:

```json
{
  "manifest_version": 3,           // Using latest Manifest V3
  "name": "Wist - Wishlist & Price Tracker",
  "version": "0.1.2",
  
  "permissions": [
    "activeTab",      // Access current tab URL
    "scripting",      // Inject scripts
    "storage",        // Store auth tokens
    "cookies"        // Access cookies (for future use)
  ],
  
  "host_permissions": [
    "https://wishlist.nuvio.cloud/*",  // Production API
    "https://*.nuvio.cloud/*",          // All subdomains
    "*://*.amazon.com/*",               // Amazon product pages
    "*://*.target.com/*",               // Target product pages
    "*://*.etsy.com/*"                  // Etsy product pages
  ],
  
  "externally_connectable": {
    "matches": [
      "https://wishlist.nuvio.cloud/*",  // Allow website to send messages
      "https://*.nuvio.cloud/*"
    ]
  },
  
  "background": {
    "service_worker": "background.js"    // Runs in background
  },
  
  "action": {
    "default_popup": "popup.html"        // Popup UI when icon clicked
  },
  
  "content_scripts": [{
    "matches": ["<all_urls>"],          // Inject on all pages
    "js": ["content.js"]                 // Content script file
  }]
}
```

**Why This Matters**:
- **host_permissions**: Allows extension to make API calls to production server
- **externally_connectable**: Allows the Wist website to send auth tokens to extension
- **content_scripts**: Injects code into web pages for "Just Got It" feature

---

### 2. **background.js** - Service Worker (API Bridge)

**Purpose**: Acts as a **middleman** between the extension UI and your Next.js API. This bypasses CORS restrictions.

**Why Service Worker?**
- Chrome extensions can't make direct fetch requests from popup/content scripts to external APIs due to CORS
- Service Workers run in a separate context and can make cross-origin requests
- They persist even when the popup is closed

**Key Functions**:

#### A. **Token Sync Handler** (External Messages)
```javascript
chrome.runtime.onMessageExternal.addListener((request, sender, sendResponse) => {
  if (request.action === "SYNC_TOKEN" && request.token) {
    // Save auth token from Wist website
    chrome.storage.local.set({ 'wist_auth_token': request.token }, () => {
      sendResponse({ success: true });
    });
    return true; // Keep channel open for async response
  }
});
```

**Flow**:
1. User logs into Wist website (`wishlist.nuvio.cloud`)
2. Website sends token to extension via `chrome.runtime.sendMessage`
3. Extension saves token to `chrome.storage.local`
4. Token persists across browser sessions

#### B. **Preview Link Handler**
```javascript
async function handlePreviewLink(productUrl, sendResponse) {
  const response = await fetch(`${API_BASE_URL}/api/preview-link`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url: productUrl })
  });
  
  const data = await response.json();
  sendResponse({ success: true, data: data.data || data });
}
```

**Flow**:
1. Popup sends `{ action: "PREVIEW_LINK", url: "https://amazon.com/..." }`
2. Background script makes API call to `/api/preview-link`
3. Server scrapes product data (title, image, price)
4. Background script sends data back to popup

#### C. **Save Item Handler**
```javascript
async function handleSaveItem(payload, sendResponse) {
  // Get auth token from storage
  chrome.storage.local.get(['wist_auth_token'], async (result) => {
    const token = result.wist_auth_token;
    
    const response = await fetch(`${API_BASE_URL}/api/items`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`  // Auth header
      },
      body: JSON.stringify(payload)
    });
    
    sendResponse({ success: true, data: await response.json() });
  });
}
```

**Flow**:
1. Popup sends `{ action: "SAVE_ITEM", data: {...} }`
2. Background script retrieves auth token from storage
3. Makes authenticated POST to `/api/items`
4. Returns success/error to popup

---

### 3. **popup.html** - UI Structure

**Purpose**: Defines the visual structure of the extension popup.

**Layout**:
```html
<body>
  <h2>Add to Wist</h2>
  
  <!-- Loading State -->
  <div id="loading" class="loading">Scanning product...</div>
  
  <!-- Error State -->
  <div id="error" class="error"></div>
  
  <!-- Content State (shown after preview loads) -->
  <div id="content">
    <div class="card">
      <img id="p-image" src="" alt="Product image" />
      <div class="card-body">
        <div id="p-title" class="card-title"></div>
        <div id="p-price" class="card-price"></div>
      </div>
    </div>
    <button id="save-btn">Save to Wishlist</button>
  </div>
</body>
```

**States**:
- **Loading**: Shows "Scanning product..." while fetching preview
- **Error**: Shows error message if preview fails
- **Content**: Shows product card with image, title, price, and save button

---

### 4. **popup.js** - Popup Logic

**Purpose**: Handles user interaction and coordinates with background script.

**Lifecycle**:

#### Step 1: **Initialization** (DOMContentLoaded)
```javascript
document.addEventListener('DOMContentLoaded', async () => {
  // 1. Get current tab URL
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  
  // 2. Show loading state
  loading.style.display = 'block';
  
  // 3. Request preview from background script
  chrome.runtime.sendMessage(
    { action: "PREVIEW_LINK", url: tab.url },
    (response) => {
      // Handle response...
    }
  );
});
```

#### Step 2: **Display Preview**
```javascript
// Populate UI with scraped data
titleEl.textContent = data.title || 'Untitled Item';
priceEl.textContent = data.price ? `$${data.price}` : 'Price not found';
imageEl.src = data.image_url;
content.style.display = 'block'; // Show content, hide loading
```

#### Step 3: **Save Button Click**
```javascript
saveBtn.onclick = async () => {
  // 1. Check if user is logged in
  chrome.storage.local.get(['wist_auth_token'], (result) => {
    const token = result.wist_auth_token;
    
    if (!token) {
      // Redirect to login
      chrome.tabs.create({ url: 'https://wishlist.nuvio.cloud/login' });
      return;
    }
    
    // 2. Send save request to background script
    chrome.runtime.sendMessage(
      { action: "SAVE_ITEM", data: {...} },
      (saveResponse) => {
        if (saveResponse.success) {
          saveBtn.textContent = "Saved!";
          setTimeout(() => window.close(), 1500);
        }
      }
    );
  });
};
```

**Key Points**:
- Uses `chrome.runtime.sendMessage` to communicate with background script
- Uses `chrome.storage.local` to check authentication
- Provides visual feedback (button states, error messages)

---

### 5. **content.js** - Content Script (Page Injection)

**Purpose**: Injects code into web pages to detect purchases and show "Just Got It" modal.

**Why Content Script?**
- Runs in the **page context**, not extension context
- Can access page DOM and detect purchase confirmations
- Can inject UI elements (modals) into the page

**Key Features**:

#### A. **Purchase Detection**
```javascript
window.addEventListener('load', () => {
  if (isOrderConfirmationPage()) {
    const purchaseData = scrapeOrderData();
    showCelebrationModal(purchaseData);
  }
});
```

**Detection Logic**:
- Checks URL for `/thankyou` or order confirmation patterns
- Checks page text for "Order placed" messages
- Amazon-specific detection

#### B. **Test Mode** (Shift + Alt + P)
```javascript
document.addEventListener('keydown', (e) => {
  if (e.shiftKey && e.altKey && (e.key === 'p' || e.key === 'P')) {
    // Simulate purchase event for testing
    showCelebrationModal(dummyData);
  }
});
```

**Use Case**: Developers can test the "Just Got It" feature without making actual purchases.

#### C. **Price Scraping** (Aggressive Finder)
```javascript
function findPrice() {
  const selectors = [
    '.a-price .a-offscreen',      // Standard items
    '#price_inside_buybox',       // Buy box
    '#corePrice_feature_div',     // Feature div
    // ... 9 total selectors
  ];
  
  for (let sel of selectors) {
    const el = document.querySelector(sel);
    if (el && /\d/.test(el.innerText)) return el.innerText;
  }
  return "$0.00";
}
```

**Why Multiple Selectors?**
- Amazon uses different price selectors for different product types
- Books, digital items, groceries, etc. have different layouts
- Fallback ensures we find the price even if page structure changes

#### D. **Celebration Modal**
```javascript
function showCelebrationModal(item) {
  const modal = document.createElement('div');
  modal.innerHTML = `
    <div class="wist-modal-content">
      <div class="wist-confetti">🎉</div>
      <h2>Treat Yourself?</h2>
      <p>Did you just buy <strong>${item.title}...</strong>?</p>
      <img src="${item.image}" />
      <button id="wist-btn-yes">Yes, Add to "Just Got It"</button>
      <button id="wist-btn-no">No, skip</button>
    </div>
  `;
  document.body.appendChild(modal);
}
```

**Styling**:
- Uses inline styles (injected via `<style>` tag)
- Matches Wist brand colors (Violet-500 primary button)
- Max z-index (2147483647) to appear above all page content
- Smooth animations (slide-in, bounce)

#### E. **Save to "Just Got It"**
```javascript
async function handleJustGotIt(item) {
  chrome.runtime.sendMessage({
    type: 'SAVE_ITEM',
    payload: {
      title: item.title,
      price: item.price,
      image_url: item.image,
      url: window.location.href,
      status: 'purchased'  // Key difference: marks as purchased
    }
  }, (response) => {
    if (response.success) {
      btn.innerText = "Saved! 🎉";
      setTimeout(removeModal, 2000);
    }
  });
}
```

**Key Difference**: Sets `status: 'purchased'` instead of `status: 'active'` (wishlist).

---

## 🔄 Data Flow

### **Scenario 1: User Clicks Extension Icon on Product Page**

```
┌─────────────┐
│ User clicks │
│ extension   │
│ icon        │
└──────┬──────┘
       │
       ▼
┌─────────────────┐
│ popup.js        │
│ DOMContentLoaded│
└──────┬──────────┘
       │
       │ 1. Get current tab URL
       │    chrome.tabs.query()
       │
       ▼
┌─────────────────┐
│ popup.js        │
│ Show loading    │
│ state           │
└──────┬──────────┘
       │
       │ 2. Send message to background
       │    chrome.runtime.sendMessage({
       │      action: "PREVIEW_LINK",
       │      url: "https://amazon.com/..."
       │    })
       │
       ▼
┌─────────────────┐
│ background.js   │
│ handlePreview   │
│ Link()           │
└──────┬──────────┘
       │
       │ 3. Make API call
       │    fetch('https://wishlist.nuvio.cloud/api/preview-link')
       │
       ▼
┌─────────────────┐
│ Next.js API     │
│ /api/preview-   │
│ link             │
└──────┬──────────┘
       │
       │ 4. Scrape product data
       │    (cheerio HTML parsing)
       │
       ▼
┌─────────────────┐
│ Return JSON     │
│ {               │
│   success: true,│
│   data: {       │
│     title: "...",│
│     price: 29.99,│
│     image: "..." │
│   }             │
│ }               │
└──────┬──────────┘
       │
       │ 5. Response flows back
       │
       ▼
┌─────────────────┐
│ popup.js        │
│ Display preview │
│ card            │
└─────────────────┘
```

### **Scenario 2: User Clicks "Save to Wishlist"**

```
┌─────────────────┐
│ User clicks     │
│ "Save to        │
│ Wishlist"       │
└──────┬──────────┘
       │
       ▼
┌─────────────────┐
│ popup.js        │
│ Check auth      │
│ token           │
└──────┬──────────┘
       │
       │ chrome.storage.local.get(['wist_auth_token'])
       │
       ▼
┌─────────────────┐
│ If no token:    │
│ Redirect to     │
│ login page      │
└─────────────────┘
       │
       │ If token exists:
       ▼
┌─────────────────┐
│ popup.js        │
│ Send SAVE_ITEM  │
│ message         │
└──────┬──────────┘
       │
       │ chrome.runtime.sendMessage({
       │   action: "SAVE_ITEM",
       │   data: {...}
       │ })
       │
       ▼
┌─────────────────┐
│ background.js   │
│ handleSaveItem()│
└──────┬──────────┘
       │
       │ fetch('https://wishlist.nuvio.cloud/api/items', {
       │   method: 'POST',
       │   headers: {
       │     'Authorization': `Bearer ${token}`
       │   },
       │   body: JSON.stringify(payload)
       │ })
       │
       ▼
┌─────────────────┐
│ Next.js API     │
│ /api/items      │
│ (POST)          │
└──────┬──────────┘
       │
       │ 5. Save to Supabase
       │    INSERT INTO items ...
       │
       ▼
┌─────────────────┐
│ Return success  │
│ { success: true }│
└──────┬──────────┘
       │
       │ 6. Response flows back
       │
       ▼
┌─────────────────┐
│ popup.js        │
│ Show "Saved!"   │
│ Close popup     │
└─────────────────┘
```

### **Scenario 3: User Completes Purchase (Just Got It)**

```
┌─────────────────┐
│ User completes  │
│ purchase on     │
│ Amazon          │
└──────┬──────────┘
       │
       │ 1. Page loads order confirmation
       │
       ▼
┌─────────────────┐
│ content.js      │
│ Detects order   │
│ confirmation    │
│ page            │
└──────┬──────────┘
       │
       │ isOrderConfirmationPage() returns true
       │
       ▼
┌─────────────────┐
│ content.js      │
│ Scrape product  │
│ data from page  │
│ (title, price,  │
│  image)         │
└──────┬──────────┘
       │
       │ 2. Show celebration modal
       │
       ▼
┌─────────────────┐
│ content.js      │
│ showCelebration │
│ Modal()         │
└──────┬──────────┘
       │
       │ User clicks "Yes, Add to Just Got It"
       │
       ▼
┌─────────────────┐
│ content.js      │
│ handleJustGotIt()│
└──────┬──────────┘
       │
       │ chrome.runtime.sendMessage({
       │   type: 'SAVE_ITEM',
       │   payload: {
       │     ...,
       │     status: 'purchased'
       │   }
       │ })
       │
       ▼
┌─────────────────┐
│ background.js   │
│ handleSaveItem()│
└──────┬──────────┘
       │
       │ Same API call as Scenario 2
       │ but with status: 'purchased'
       │
       ▼
┌─────────────────┐
│ Next.js API     │
│ Saves with      │
│ status:          │
│ 'purchased'      │
└─────────────────┘
```

---

## 📨 Message Passing System

### **Message Types**

#### 1. **PREVIEW_LINK** (Popup → Background)
```javascript
// Sent from: popup.js
// Received by: background.js
{
  action: "PREVIEW_LINK",
  url: "https://amazon.com/dp/B08N5WRWNW"
}

// Response:
{
  success: true,
  data: {
    title: "Product Title",
    price: 29.99,
    image_url: "https://...",
    retailer: "Amazon"
  }
}
```

#### 2. **SAVE_ITEM** (Popup/Content → Background)
```javascript
// Sent from: popup.js or content.js
// Received by: background.js
{
  action: "SAVE_ITEM",  // From popup.js
  // OR
  type: "SAVE_ITEM",   // From content.js
  data: {              // From popup.js
    // OR
  payload: {           // From content.js
    title: "...",
    price: "...",
    url: "...",
    image_url: "...",
    retailer: "...",
    status: "active" | "purchased"
  }
}

// Response:
{
  success: true,
  data: { id: "...", ... }
}
```

#### 3. **SYNC_TOKEN** (Website → Extension)
```javascript
// Sent from: Wist website (ExtensionSync.tsx)
// Received by: background.js (onMessageExternal)
{
  action: "SYNC_TOKEN",
  token: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}

// Response:
{
  success: true
}
```

#### 4. **GET_USER_TOKEN** (Popup → Background)
```javascript
// Sent from: popup.js
// Received by: background.js
{
  action: "GET_USER_TOKEN"
}

// Response:
{
  token: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

---

## 🔐 Authentication Flow

### **Step 1: User Logs into Wist Website**

```
┌─────────────────┐
│ User visits     │
│ wishlist.nuvio. │
│ cloud/login     │
└──────┬──────────┘
       │
       │ 1. User enters credentials
       │
       ▼
┌─────────────────┐
│ Next.js Auth    │
│ (Supabase)      │
└──────┬──────────┘
       │
       │ 2. Returns session token
       │
       ▼
┌─────────────────┐
│ ExtensionSync. │
│ tsx component   │
│ (on website)    │
└──────┬──────────┘
       │
       │ 3. Sends token to extension
       │    chrome.runtime.sendMessage({
       │      action: "SYNC_TOKEN",
       │      token: session.access_token
       │    })
       │
       ▼
┌─────────────────┐
│ background.js   │
│ onMessageExternal│
│ Listener        │
└──────┬──────────┘
       │
       │ 4. Save token to storage
       │    chrome.storage.local.set({
       │      'wist_auth_token': token
       │    })
       │
       ▼
┌─────────────────┐
│ Token persisted │
│ in extension    │
│ storage         │
└─────────────────┘
```

### **Step 2: Extension Uses Token for API Calls**

```javascript
// In background.js handleSaveItem()
chrome.storage.local.get(['wist_auth_token'], async (result) => {
  const token = result.wist_auth_token;
  
  const response = await fetch(`${API_BASE_URL}/api/items`, {
    headers: {
      'Authorization': `Bearer ${token}`  // Token sent in header
    },
    // ...
  });
});
```

**Security Notes**:
- Token is stored in `chrome.storage.local` (encrypted by Chrome)
- Token persists across browser sessions
- Token is sent as Bearer token in Authorization header
- API validates token using Supabase Auth

---

## 🌐 API Integration

### **API Endpoints Used**

#### 1. **POST /api/preview-link**
**Purpose**: Scrape product metadata for preview card

**Request**:
```json
{
  "url": "https://amazon.com/dp/B08N5WRWNW"
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "url": "https://amazon.com/dp/B08N5WRWNW",
    "title": "Product Title",
    "price": 29.99,
    "image_url": "https://...",
    "retailer": "Amazon",
    "description": "Product description..."
  }
}
```

**Implementation**: Uses cheerio to parse HTML (lightweight, Vercel-safe)

#### 2. **POST /api/items**
**Purpose**: Save item to user's wishlist

**Request**:
```json
{
  "title": "Product Title",
  "price": "29.99",
  "url": "https://amazon.com/dp/B08N5WRWNW",
  "image_url": "https://...",
  "retailer": "Amazon",
  "description": "..."
}
```

**Headers**:
```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Content-Type: application/json
```

**Response**:
```json
{
  "success": true,
  "item": {
    "id": "uuid",
    "title": "Product Title",
    "current_price": 29.99,
    "status": "active",
    // ...
  }
}
```

**Implementation**: Inserts into Supabase `items` table with `user_id` from token

---

## 🎨 UI Components

### **Popup UI States**

#### **Loading State**
```html
<div id="loading" class="loading">
  Scanning product...
</div>
```
- Shown while fetching preview
- Centered text, gray color

#### **Error State**
```html
<div id="error" class="error">
  Failed to fetch product details.
</div>
```
- Red background (#fee2e2)
- Rounded corners
- Shown on API errors or network failures

#### **Content State**
```html
<div id="content">
  <div class="card">
    <img id="p-image" src="..." />
    <div class="card-body">
      <div id="p-title">Product Title</div>
      <div id="p-price">$29.99</div>
    </div>
  </div>
  <button id="save-btn">Save to Wishlist</button>
</div>
```
- Product card with image, title, price
- Save button (Violet-500 brand color)
- Button states: Normal → Saving... → Saved! / Try Again

### **Celebration Modal** (Content Script)

**Location**: Injected into page (not popup)

**Structure**:
```html
<div id="wist-celebration-modal">
  <div class="wist-modal-content">
    <div class="wist-confetti">🎉</div>
    <h2>Treat Yourself?</h2>
    <p>Did you just buy <strong>Product Title...</strong>?</p>
    <img src="..." class="wist-preview-img" />
    <button id="wist-btn-yes">Yes, Add to "Just Got It"</button>
    <button id="wist-btn-no">No, skip</button>
    <div class="wist-powered">Powered by Wist</div>
  </div>
</div>
```

**Styling**:
- White background, rounded corners
- Shadow-xl (matches Dashboard)
- Violet-500 primary button
- Max z-index to appear above all content
- Slide-in animation

---

## ⚠️ Error Handling

### **Network Errors**

```javascript
// In background.js
catch (error) {
  console.error("❌ WIST: Error", error);
  sendResponse({ 
    success: false, 
    error: error.message 
  });
}
```

**Common Errors**:
- `Failed to fetch` → Server unreachable
- `Server returned 500` → Server error (check logs)
- `Server returned 401` → Token expired/invalid
- `Server returned 403` → Permission denied

### **Authentication Errors**

```javascript
// In popup.js
if (!token) {
  showError("Please log in to Wist first.");
  chrome.tabs.create({ url: 'https://wishlist.nuvio.cloud/login' });
  return;
}
```

**Handling**:
- Check token before making API calls
- Redirect to login if token missing
- Show helpful error messages

### **Chrome Extension Errors**

```javascript
// In popup.js
if (chrome.runtime.lastError) {
  showError(chrome.runtime.lastError.message || "Extension error occurred.");
  return;
}
```

**Common Issues**:
- Service Worker not running → Reload extension
- Message channel closed → Check return value in listener
- Permission denied → Check manifest.json permissions

---

## 🔧 Development Notes

### **Testing the Extension**

1. **Load Extension**:
   - Go to `chrome://extensions/`
   - Enable "Developer mode"
   - Click "Load unpacked"
   - Select `wist-extension` folder

2. **Test Preview**:
   - Navigate to Amazon product page
   - Click extension icon
   - Should show preview card

3. **Test Save**:
   - Click "Save to Wishlist"
   - Should save to database
   - Button should show "Saved!"

4. **Test "Just Got It"**:
   - On Amazon product page, press `Shift + Alt + P`
   - Should show celebration modal
   - Click "Yes" to save as purchased

### **Debugging**

**Service Worker Console**:
- Go to `chrome://extensions/`
- Find Wist extension
- Click "Inspect views: service worker"
- View console logs

**Popup Console**:
- Right-click extension icon
- Select "Inspect popup"
- View console logs

**Content Script Console**:
- Open DevTools on any page
- Console shows content script logs

### **Common Issues**

1. **"Port 3000 failed"**:
   - Old code cached → Reload extension
   - Check `API_BASE_URL` in background.js

2. **CORS Errors**:
   - Make sure API calls go through background script
   - Check `host_permissions` in manifest.json

3. **Token Not Syncing**:
   - Check `externally_connectable` in manifest.json
   - Verify website URL matches pattern
   - Check ExtensionSync.tsx on website

---

## 📊 Summary

**Architecture Pattern**: **Message-Passing Service Worker**

**Key Principles**:
1. **Separation of Concerns**: UI (popup), Logic (background), Page Interaction (content)
2. **CORS Bypass**: All API calls go through Service Worker
3. **Token Persistence**: Auth tokens stored in Chrome Storage
4. **User Experience**: Fast previews, clear feedback, helpful errors

**File Responsibilities**:
- `manifest.json` → Configuration
- `background.js` → API bridge
- `popup.html/js` → User interface
- `content.js` → Page interaction
- `styles.css` → Global styles

**Data Flow**: Popup → Background → API → Database

This architecture ensures the extension is **fast**, **reliable**, and **user-friendly**.

