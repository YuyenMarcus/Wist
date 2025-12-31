// background.js - Production Force
// 🚨 IF YOU SEE 'PORT 3000' ERRORS, YOU ARE RUNNING OLD CODE 🚨
// This file has NO port detection logic. If you see port errors, Chrome is cached.

const API_BASE_URL = "https://wishlist.nuvio.cloud";

// PROOF MARKER: This log MUST appear if new code is running
console.log("🔒🔒🔒 WIST v2.0 - NEW CODE LOADED - NO PORTS 🔒🔒🔒");

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "PREVIEW_LINK") {
    console.log("🔒 WIST: Preview requested for", request.url);
    handlePreviewLink(request.url, sendResponse);
    return true;
  }

  if (request.action === "SAVE_ITEM") {
    handleSaveItem(request.data, sendResponse);
    return true;
  }

  if (request.action === "SYNC_TOKEN") {
    chrome.storage.local.set({ 'wist_auth_token': request.token }, () => {
      sendResponse({ success: true });
    });
    return true;
  }

  if (request.action === "TRIGGER_PURCHASE_POPUP") {
    chrome.tabs.sendMessage(sender.tab.id, {
      action: "TRIGGER_PURCHASE_POPUP",
      url: request.url
    }).catch(() => {});
  }

  if (request.action === "GET_USER_TOKEN") {
    chrome.storage.local.get(['wist_auth_token'], (result) => {
      sendResponse({ token: result.wist_auth_token });
    });
    return true;
  }
});

chrome.runtime.onMessageExternal.addListener((request, sender, sendResponse) => {
  if (request.action === "SYNC_TOKEN" && request.token) {
    chrome.storage.local.set({ 'wist_auth_token': request.token }, () => {
      sendResponse({ success: true });
    });
    return true;
  }
});

async function handlePreviewLink(productUrl, sendResponse) {
  console.log("🔒 WIST: Fetching from", API_BASE_URL);
  
  try {
    const response = await fetch(`${API_BASE_URL}/api/preview-link`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: productUrl })
    });
    
    if (!response.ok) {
      throw new Error(`Server returned ${response.status}`);
    }

    const data = await response.json();
    sendResponse({ success: true, data: data.data || data });
  } catch (error) {
    console.error("❌ WIST: Error", error.message);
    sendResponse({ success: false, error: error.message });
  }
}

async function handleSaveItem(itemData, sendResponse) {
  try {
    const result = await chrome.storage.local.get(['wist_auth_token']);
    const token = result.wist_auth_token;

    if (!token) {
      sendResponse({ 
        success: false, 
        error: "Not logged in. Please log in to Wist first.",
        requiresAuth: true 
      });
      return;
    }

    const response = await fetch(`${API_BASE_URL}/api/items`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`,
      },
      body: JSON.stringify({
        title: itemData.title,
        price: itemData.price ? String(itemData.price) : null,
        url: itemData.url,
        image_url: itemData.image_url || null,
        retailer: itemData.retailer || 'Unknown',
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: `HTTP ${response.status}` }));
      throw new Error(errorData.error || `Server error: ${response.status}`);
    }

    const data = await response.json();
    sendResponse({ success: true, data: data.item || data });
  } catch (error) {
    console.error("Wist Save Error:", error);
    sendResponse({ success: false, error: error.message });
  }
}
