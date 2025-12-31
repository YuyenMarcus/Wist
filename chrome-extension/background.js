// background.js - The API Bridge
// Handles network requests to Next.js API (bypasses CORS)

// API Base URL - Auto-detect production vs development
const API_BASE_URL = "https://wishlist.nuvio.cloud";

// 1. Listen for messages from content script, popup, or external website
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "PREVIEW_LINK") {
    handlePreviewLink(request.url, sendResponse);
    return true; // Indicates we will respond asynchronously
  }

  if (request.action === "SAVE_ITEM") {
    handleSaveItem(request.data, sendResponse);
    return true; // Indicates we will respond asynchronously
  }

  if (request.action === "SYNC_TOKEN") {
    // Handle token sync from website (ExtensionSync.tsx)
    chrome.storage.local.set({ 'wist_auth_token': request.token }, () => {
      console.log("✅ Wist: Auth token synced from website");
      sendResponse({ success: true });
    });
    return true;
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

// Listen for external messages from website (ExtensionSync.tsx)
chrome.runtime.onMessageExternal.addListener(
  (request, sender, sendResponse) => {
    if (request.action === "SYNC_TOKEN" && request.token) {
      console.log("✅ Wist: Received Auth Token from website!");
      
      // Save it to internal extension storage
      chrome.storage.local.set({ 'wist_auth_token': request.token }, () => {
        sendResponse({ success: true });
      });
      return true; // Async response
    }
  }
);

// 2. Function to call your Next.js API for preview
async function handlePreviewLink(productUrl, sendResponse) {
  try {
    const apiUrl = `${API_BASE_URL}/api/preview-link`;
    console.log("🔗 Fetching preview from:", apiUrl);
    console.log("📦 Product URL:", productUrl);

    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ url: productUrl }),
    });

    console.log("📡 Response status:", response.status, response.statusText);

    if (!response.ok) {
      const errorText = await response.text();
      console.error("❌ API Error Response:", errorText);
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    console.log("✅ API Response:", data);

    if (data.success) {
      sendResponse({ success: true, data: data.data });
    } else {
      sendResponse({ success: false, error: data.error || "Failed to fetch product details" });
    }
  } catch (error) {
    console.error("❌ Wist Preview API Error:", error);
    console.error("Error details:", {
      name: error.name,
      message: error.message,
      stack: error.stack
    });
    
    // More specific error messages
    let errorMessage = "Network error connecting to Wist.";
    if (error.message.includes("Failed to fetch") || error.message.includes("Both ports failed")) {
      errorMessage = "Cannot connect to Wist API. Check your internet connection and make sure wishlist.nuvio.cloud is accessible.";
    } else if (error.message.includes("HTTP")) {
      errorMessage = `Server error: ${error.message}`;
    } else {
      errorMessage = `Error: ${error.message}`;
    }
    
    sendResponse({ 
      success: false, 
      error: errorMessage 
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
