// background.js - Production Force
// VERSION: 2.0 - PRODUCTION ONLY (No localhost)
// Last Updated: 2025-01-XX - Hard-coded production URL

// ---------------------------------------------------------------------------
// 🚨 PRODUCTION URL - NO LOCALHOST
// ---------------------------------------------------------------------------
const API_BASE_URL = "https://wishlist.nuvio.cloud";

// PROOF: If you see this log, the NEW code is running
console.log("═══════════════════════════════════════");
console.log("🔒 WIST EXTENSION v2.0 - PRODUCTION MODE");
console.log("📍 API URL:", API_BASE_URL);
console.log("✅ This is the NEW code (no localhost logic)");
console.log("═══════════════════════════════════════");

// Message listener
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "PREVIEW_LINK") {
    handlePreviewLink(request.url, sendResponse);
    return true;
  }

  if (request.action === "SAVE_ITEM") {
    handleSaveItem(request.data, sendResponse);
    return true;
  }

  if (request.action === "SYNC_TOKEN") {
    chrome.storage.local.set({ 'wist_auth_token': request.token }, () => {
      console.log("✅ Wist: Auth token synced from website");
      sendResponse({ success: true });
    });
    return true;
  }

  if (request.action === "TRIGGER_PURCHASE_POPUP") {
    chrome.tabs.sendMessage(sender.tab.id, {
      action: "TRIGGER_PURCHASE_POPUP",
      url: request.url
    }).catch(err => console.error("Failed to trigger purchase popup:", err));
  }

  if (request.action === "GET_USER_TOKEN") {
    chrome.storage.local.get(['wist_auth_token'], (result) => {
      sendResponse({ token: result.wist_auth_token });
    });
    return true;
  }
});

// External message listener (from website)
chrome.runtime.onMessageExternal.addListener(
  (request, sender, sendResponse) => {
    if (request.action === "SYNC_TOKEN" && request.token) {
      console.log("✅ Wist: Received Auth Token from website!");
      chrome.storage.local.set({ 'wist_auth_token': request.token }, () => {
        sendResponse({ success: true });
      });
      return true;
    }
  }
);

// Preview link handler
async function handlePreviewLink(productUrl, sendResponse) {
  const apiUrl = `${API_BASE_URL}/api/preview-link`;
  
  console.log("🔗 WIST v2.0: Preview Request to:", apiUrl);
  console.log("📦 Product URL:", productUrl);

  try {
    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ url: productUrl }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }

    const data = await response.json();

    if (data.success) {
      sendResponse({ success: true, data: data.data });
    } else {
      sendResponse({ success: false, error: data.error || "Failed to fetch product details" });
    }
  } catch (error) {
    console.error("❌ WIST v2.0: Fetch Error:", error.name, error.message);
    sendResponse({ 
      success: false, 
      error: error.message || "Network error connecting to Wist."
    });
  }
}

// Save item handler
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

    const payload = {
      title: itemData.title,
      price: itemData.price ? String(itemData.price) : null,
      url: itemData.url,
      image_url: itemData.image_url || null,
      retailer: itemData.retailer || 'Unknown',
    };

    const response = await fetch(`${API_BASE_URL}/api/items`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: `HTTP ${response.status}` }));
      throw new Error(errorData.error || `Server error: ${response.status}`);
    }

    const data = await response.json();

    if (data.success || data.item) {
      sendResponse({ success: true, data: data.item || data });
    } else {
      sendResponse({ success: false, error: data.error || "Failed to save item" });
    }
  } catch (error) {
    console.error("Wist Save API Error:", error);
    sendResponse({ 
      success: false, 
      error: error.message || "Network error saving item. Please try again." 
    });
  }
}

// Test function (for Service Worker console)
self.testAPI = async function() {
  console.log("🔍 WIST v2.0: Testing API connection to:", API_BASE_URL);
  try {
    const response = await fetch(`${API_BASE_URL}/api/preview-link`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: 'https://amazon.com/dp/B08N5WRWNW' })
    });
    console.log("✅ Status:", response.status);
    const data = await response.json();
    console.log("✅ Response:", data);
    return { success: true, data };
  } catch (error) {
    console.error("❌ Error:", error.name, error.message);
    return { success: false, error: error.message };
  }
};
