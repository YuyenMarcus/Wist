// background.js - The API Bridge
// Handles network requests to Next.js API (bypasses CORS)

// ---------------------------------------------------------------------------
// 🚨 CONFIGURATION: PRODUCTION ONLY
// ---------------------------------------------------------------------------
// DO NOT use localhost here. We are forcing production to prevent "Both ports failed" errors.
const API_BASE_URL = "https://wishlist.nuvio.cloud"; 

console.log("🔒 WIST: Forcing Production URL:", API_BASE_URL);
// ---------------------------------------------------------------------------

// TEST FUNCTION: Run testAPI() in Service Worker console to test connection
self.testAPI = async function() {
  console.log("🔍 Testing API connection to:", API_BASE_URL);
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
  const apiUrl = `${API_BASE_URL}/api/preview-link`;
  
  console.log("🔗 WIST: Preview Request to:", apiUrl);
  console.log("📦 Product URL:", productUrl);

  try {
    // First, test if the endpoint is reachable
    console.log("🌐 Attempting fetch to:", apiUrl);
    console.log("🌐 Fetch method: POST");
    console.log("🌐 Fetch headers: Content-Type: application/json");
    
    const fetchOptions = {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ url: productUrl }),
    };
    
    console.log("🌐 Fetch options:", JSON.stringify(fetchOptions, null, 2));
    
    const response = await fetch(apiUrl, fetchOptions);

    console.log("📡 Response received!");
    console.log("   Status:", response.status);
    console.log("   Status Text:", response.statusText);
    console.log("   Headers:", Object.fromEntries(response.headers.entries()));

    if (!response.ok) {
      const errorText = await response.text();
      console.error("❌ API returned error status");
      console.error("   Error body:", errorText);
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    console.log("✅ API Response parsed successfully");
    console.log("   Success:", data.success);
    console.log("   Data keys:", data.data ? Object.keys(data.data) : "No data");

    if (data.success) {
      sendResponse({ success: true, data: data.data });
    } else {
      sendResponse({ success: false, error: data.error || "Failed to fetch product details" });
    }
  } catch (error) {
    console.error("═══════════════════════════════════════");
    console.error("❌ WIST EXTENSION: Fetch Failed");
    console.error("   Error Name:", error.name);
    console.error("   Error Message:", error.message);
    console.error("   Error Type:", typeof error);
    console.error("   Full Error:", error);
    console.error("═══════════════════════════════════════");
    
    // Decode common Chrome extension errors
    let errorMessage = "Network error connecting to Wist.";
    
    if (error.message.includes("Failed to fetch") || 
        error.message.includes("Both ports failed") ||
        error.message.includes("ERR_CONNECTION_REFUSED")) {
      errorMessage = `Cannot connect to ${API_BASE_URL}. Check:\n1. Is the server running?\n2. Is the URL correct?\n3. Check firewall/network settings.`;
    } else if (error.message.includes("ERR_NAME_NOT_RESOLVED")) {
      errorMessage = `DNS lookup failed for ${API_BASE_URL}. Check your internet connection.`;
    } else if (error.message.includes("ERR_SSL")) {
      errorMessage = `SSL error connecting to ${API_BASE_URL}. Certificate issue?`;
    } else if (error.message.includes("HTTP")) {
      errorMessage = `Server error: ${error.message}`;
    } else {
      errorMessage = `Error: ${error.message}`;
    }
    
    sendResponse({ 
      success: false, 
      error: errorMessage,
      debug: {
        apiUrl,
        errorName: error.name,
        errorMessage: error.message
      }
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
