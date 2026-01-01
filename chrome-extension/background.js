// background.js - Production Force
// 🚨 IF YOU SEE 'PORT 3000' ERRORS, YOU ARE RUNNING OLD CODE 🚨

const API_BASE_URL = "https://wishlist.nuvio.cloud";

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "PREVIEW_LINK") {
    console.log("🔒 WIST: Preview requested for", request.url);
    handlePreviewLink(request.url, sendResponse);
    return true; // Keep channel open
  }
});

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
    sendResponse({ success: true, data });
  } catch (error) {
    console.error("❌ WIST: Error", error);
    sendResponse({ success: false, error: error.message });
  }
}
