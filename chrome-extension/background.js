// background.js - The API Bridge
// Handles network requests to Next.js API (bypasses CORS)

// API Base URL - Auto-detect production vs development
const API_BASE_URL = "https://wishlist.nuvio.cloud";

// 1. Listen for messages from content script or popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "PREVIEW_LINK") {
    handlePreviewLink(request.url, sendResponse);
    return true; // Indicates we will respond asynchronously
  }

  if (request.action === "SAVE_ITEM") {
    handleSaveItem(request.data, sendResponse);
    return true; // Indicates we will respond asynchronously
  }

  if (request.action === "TRIGGER_PURCHASE_POPUP") {
    // Trigger purchase popup logic (from previous implementation)
    chrome.tabs.sendMessage(sender.tab.id, {
      action: "TRIGGER_PURCHASE_POPUP",
      url: request.url
    }).catch(err => console.error("Failed to trigger purchase popup:", err));
  }

  if (request.action === "GET_USER_TOKEN") {
    // Get auth token from storage
    chrome.storage.local.get(['wist_auth_token'], (result) => {
      sendResponse({ token: result.wist_auth_token });
    });
    return true;
  }
});

// 2. Function to call your Next.js API for preview
async function handlePreviewLink(productUrl, sendResponse) {
  try {
    const response = await fetch(`${API_BASE_URL}/api/preview-link`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ url: productUrl }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();

    if (data.success) {
      sendResponse({ success: true, data: data.data });
    } else {
      sendResponse({ success: false, error: data.error || "Failed to fetch product details" });
    }
  } catch (error) {
    console.error("Wist Preview API Error:", error);
    sendResponse({ 
      success: false, 
      error: `Network error: ${error.message}. Make sure you're connected to the internet.` 
    });
  }
}

// 3. Function to save item to wishlist
async function handleSaveItem(itemData, sendResponse) {
  try {
    // Step 1: Get auth token from storage
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

    // Step 2: Prepare the payload
    const payload = {
      title: itemData.title,
      price: itemData.price ? String(itemData.price) : null,
      url: itemData.url,
      image_url: itemData.image_url || null,
      retailer: itemData.retailer || 'Unknown',
    };

    // Step 3: Make POST request to /api/items
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
