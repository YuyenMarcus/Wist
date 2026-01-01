// background.js - Production Force
// 🚨 IF YOU SEE 'PORT 3000' ERRORS, YOU ARE RUNNING OLD CODE 🚨

const API_BASE_URL = "https://wishlist.nuvio.cloud";

// PROOF: If you see this log, the NEW code is running
console.log("🔒🔒🔒 WIST v2.0 - PRODUCTION MODE - NO PORTS 🔒🔒🔒");

// Listen for the "Handshake" from your website
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

// Message listener
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "PREVIEW_LINK") {
    console.log("🔒 WIST: Preview requested for", request.url);
    handlePreviewLink(request.url, sendResponse);
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

  if (request.type === 'SAVE_ITEM') {
    handleSaveItem(request.payload, sendResponse);
    return true;
  }
});

// Preview link handler - PRODUCTION ONLY
async function handlePreviewLink(productUrl, sendResponse) {
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
    console.log("✅ WIST: Success", data);
    sendResponse({ success: true, data: data.data || data });
  } catch (error) {
    console.error("❌ WIST: Error", error);
    sendResponse({ success: false, error: error.message });
  }
}

// Save item handler - PRODUCTION ONLY
async function handleSaveItem(payload, sendResponse) {
  try {
    chrome.storage.local.get(['wist_auth_token'], async (result) => {
      const token = result.wist_auth_token;

      const headers = {
        'Content-Type': 'application/json',
      };

      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch(`${API_BASE_URL}/api/items`, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: `HTTP ${response.status}` }));
        throw new Error(errorData.error || `Server error: ${response.status}`);
      }

      const data = await response.json();
      sendResponse({ success: true, data: data });
    });
  } catch (error) {
    console.error("Wist Save Error:", error);
    sendResponse({ success: false, error: error.message });
  }
}
