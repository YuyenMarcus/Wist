// background.js - The API Bridge
// Handles network requests to Next.js API (bypasses CORS)

// 1. Listen for messages from content script or popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "PREVIEW_LINK") {
    handlePreviewLink(request.url, sendResponse);
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

// 2. Function to call your Next.js API
async function handlePreviewLink(productUrl, sendResponse) {
  try {
    // CHANGE THIS to your production URL when you deploy
    // For development: http://localhost:3000
    // For production: https://wishlist.nuvio.cloud
    const API_ENDPOINT = "http://localhost:3000/api/preview-link";

    const response = await fetch(API_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ url: productUrl }),
    });

    const data = await response.json();

    if (data.success) {
      sendResponse({ success: true, data: data.data });
    } else {
      sendResponse({ success: false, error: data.error });
    }
  } catch (error) {
    console.error("Wist API Error:", error);
    sendResponse({ success: false, error: "Network error connecting to Wist." });
  }
}
