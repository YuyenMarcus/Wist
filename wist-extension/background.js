// background.js - Production Force
// 🚨 IF YOU SEE 'PORT 3000' ERRORS, YOU ARE RUNNING OLD CODE 🚨

const API_BASE_URL = "https://wishlist.nuvio.cloud";

// PROOF: If you see this log, the NEW code is running
console.log("🔒🔒🔒 WIST v2.0 - PRODUCTION MODE - NO PORTS 🔒🔒🔒");

// ---------------------------------------------------------------------------
// 📡 EXTERNAL LISTENER (Listens to the Website)
// ---------------------------------------------------------------------------
chrome.runtime.onMessageExternal.addListener((message, sender, sendResponse) => {
  console.log("📨 [Background] Message received from:", sender.url);
  console.log("📦 [Background] Message type:", message.type);
  
  if (message.type === 'AUTH_TOKEN') {
    console.log("🔑 [Background] Auth token received");
    
    const token = message.token;
    const session = message.session;
    
    if (!token) {
      console.warn("⚠️ WIST: Sync request received but token was empty.");
      sendResponse({ success: false, error: "No token provided" });
      return true;
    }
    
    // Store in chrome.storage.local (using new keys: supabase_token and supabase_session)
    chrome.storage.local.set({
      supabase_token: token,
      supabase_session: session,
      last_sync: Date.now(),
      // Also keep old key for backward compatibility
      wist_auth_token: token
    }, () => {
      if (chrome.runtime.lastError) {
        console.error("❌ [Background] Storage error:", chrome.runtime.lastError);
        sendResponse({ success: false, error: chrome.runtime.lastError.message });
      } else {
        console.log("✅ [Background] Token stored successfully");
        sendResponse({ success: true, message: 'Token stored' });
      }
    });
    
    return true; // Keep channel open for async response
  }
  
  // Handle legacy format for backward compatibility
  if (request.action === "SYNC_TOKEN" || request.type === "WIST_AUTH_TOKEN") {
    const token = request.token;
    
    if (token) {
      chrome.storage.local.set({ 
        'wist_auth_token': token,
        'supabase_token': token,
        last_sync: Date.now()
      }, () => {
        console.log("✅ WIST: Auth Token Synced from Website!");
        sendResponse({ success: true, message: "Token received" });
      });
    } else {
      console.warn("⚠️ WIST: Sync request received but token was empty.");
      sendResponse({ success: false, error: "No token provided" });
    }
    
    return true;
  }
});

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

  if (request.action === "GET_USER_TOKEN" || request.type === "GET_TOKEN") {
    // Content script or popup is asking for the token
    chrome.storage.local.get(['supabase_token', 'supabase_session', 'wist_auth_token'], (result) => {
      if (chrome.runtime.lastError) {
        sendResponse({ success: false, error: chrome.runtime.lastError.message });
      } else {
        console.log("📤 [Background] Sending token to requester");
        sendResponse({ 
          success: true, 
          token: result.supabase_token || result.wist_auth_token,
          session: result.supabase_session 
        });
      }
    });
    return true;
  }

  // Handle SAVE_ITEM from popup.js (uses request.action and request.data)
  if (request.action === "SAVE_ITEM") {
    console.log("💾 WIST: Save Request", request.data);
    handleSaveItem(request.data, sendResponse);
    return true;
  }

  // Handle SAVE_ITEM from content.js (uses request.type and request.payload)
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
    console.log("💾 [Background] Saving item...");
    console.log("🔵 [Extension] Save Request Received", payload);
    
    // 1. GET TOKEN FROM CHROME STORAGE (Not localStorage)
    // Try new keys first, then fall back to old key for backward compatibility
    const stored = await chrome.storage.local.get(['supabase_token', 'supabase_session', 'wist_auth_token']);
    
    let token = null;
    
    // Check if token is stored directly in new key
    if (stored.supabase_token) {
      token = stored.supabase_token;
      console.log("✅ [Extension] Found token in supabase_token");
    }
    // Check if token is in session object
    else if (stored.supabase_session) {
      const session = typeof stored.supabase_session === 'string' 
        ? JSON.parse(stored.supabase_session) 
        : stored.supabase_session;
      
      token = session.access_token || session.token;
      console.log("✅ [Extension] Found token in supabase_session");
    }
    // Fall back to old key
    else if (stored.wist_auth_token) {
      token = stored.wist_auth_token;
      console.log("✅ [Extension] Found token in wist_auth_token (legacy)");
    }

    if (!token) {
      console.error("❌ [Extension] No auth token found in chrome.storage.local");
      console.error("Available data:", Object.keys(stored));
      throw new Error("Not logged in. Please log in on the Wist website first.");
    }

    // 2. CLEAN THE TOKEN
    // Remove any accidental quotes sent by JSON.stringify
    if (typeof token === 'string') {
      token = token.replace(/^"|"$/g, '').trim();
    }

    console.log("✅ [Extension] Token extracted, length:", token.length);
    console.log("🔑 [Extension] Token preview:", token.substring(0, 20) + "...");

    // 3. PREPARE DATA
    // Ensure we send the data the server expects so it skips the scraper
    const apiPayload = {
      url: payload.url,
      title: payload.title || "Untitled",
      price: parseFloat(payload.price) || 0,
      image_url: payload.image_url || "",
      retailer: payload.retailer || "Unknown",
      note: payload.note || ""
    };

    console.log("📦 [Extension] Payload:", JSON.stringify(apiPayload, null, 2));
    console.log("🌐 [Extension] Sending to:", `${API_BASE_URL}/api/items`);

    // 4. SEND TO API
    const response = await fetch(`${API_BASE_URL}/api/items`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}` // <--- Critical Header
      },
      body: JSON.stringify(apiPayload)
    });

    console.log("📡 [Extension] Response status:", response.status);

    // 5. HANDLE RESPONSE
    const result = await response.json();
    
    if (!response.ok) {
      console.error("❌ [Extension] API Error:", result);
      throw new Error(result.error || `Server Error ${response.status}`);
    }

    console.log("✅ [Background] Item saved successfully");
    console.log("✅ [Extension] Save Success:", result);
    sendResponse({ success: true, data: result });

  } catch (error) {
    console.error("❌ [Background] Save failed:", error);
    console.error("❌ [Extension] Failed:", error.message);
    console.error("❌ [Extension] Full error:", error);
    sendResponse({ success: false, error: error.message });
  }
}
