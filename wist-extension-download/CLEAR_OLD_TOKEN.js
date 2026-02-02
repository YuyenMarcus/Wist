// EMERGENCY: Clear Old Expired Token
// Paste this in your extension's service worker console (chrome://extensions → Inspect views: service worker)

chrome.storage.local.clear(() => {
  console.log("✅ Storage cleared - Old token removed!");
  console.log("💡 Now visit wishlist.nuvio.cloud and refresh the page to sync a fresh token");
});

