// background.js - The Watchtower
// Monitors tab updates for purchase confirmation pages

const SUCCESS_PATTERNS = [
  /amazon\.com\/gp\/buy\/thankyou/,
  /amazon\.com\/.*\/order-confirmation/,
  /target\.com\/co-cart\/order-confirmation/,
  /etsy\.com\/your\/purchases\/.*\/confirmation/,
  /shopify\.com\/.*\/thank_you/,
  /bestbuy\.com\/.*\/order-confirmation/,
  /bestbuy\.com\/checkout\/.*\/confirmation/,
  /walmart\.com\/checkout\/.*\/confirm/,
];

// Track which tabs we've already triggered to avoid duplicates
const triggeredTabs = new Set();

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url) {
    const isPurchasePage = SUCCESS_PATTERNS.some(pattern => pattern.test(tab.url));
    const tabKey = `${tabId}-${tab.url}`;

    if (isPurchasePage && !triggeredTabs.has(tabKey)) {
      console.log("🎉 Wist: Purchase detected on", tab.url);
      triggeredTabs.add(tabKey);

      // Inject the content script and trigger the popup
      chrome.scripting.executeScript({
        target: { tabId },
        files: ['content.js']
      }).then(() => {
        // Send message to content script to trigger purchase popup
        chrome.tabs.sendMessage(tabId, {
          action: "TRIGGER_PURCHASE_POPUP",
          url: tab.url
        }).catch(err => {
          console.error("Failed to send message to content script:", err);
          // If message fails, try injecting again after a short delay
          setTimeout(() => {
            chrome.tabs.sendMessage(tabId, {
              action: "TRIGGER_PURCHASE_POPUP",
              url: tab.url
            });
          }, 1000);
        });
      }).catch(err => {
        console.error("Failed to inject content script:", err);
      });
    }
  }
});

// Clean up triggered tabs when they're closed
chrome.tabs.onRemoved.addListener((tabId) => {
  const keysToDelete = [];
  triggeredTabs.forEach(key => {
    if (key.startsWith(`${tabId}-`)) {
      keysToDelete.push(key);
    }
  });
  keysToDelete.forEach(key => triggeredTabs.delete(key));
});

// Handle messages from content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "GET_USER_TOKEN") {
    // Get auth token from storage (set by popup/login flow)
    chrome.storage.local.get(['wist_auth_token'], (result) => {
      sendResponse({ token: result.wist_auth_token });
    });
    return true; // Keep channel open for async response
  }
});

