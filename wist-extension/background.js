// background.js - Production Force with Auto Token Refresh
// 🚨 IF YOU SEE 'PORT 3000' ERRORS, YOU ARE RUNNING OLD CODE 🚨

const API_BASE_URL = "https://wishlist.nuvio.cloud";

// PROOF: If you see this log, the NEW code is running
console.log("🔒🔒🔒 WIST v2.0 - PRODUCTION MODE - NO PORTS 🔒🔒🔒");
console.log("🟢 [Background] Service Worker started");

// ============================================================================
// TOKEN MANAGEMENT
// ============================================================================

// Listen for messages from the website
chrome.runtime.onMessageExternal.addListener((message, sender, sendResponse) => {
  console.log("📨 [Background] External message from:", sender.url);
  console.log("📦 [Background] Message type:", message.type);
  
  if (message.type === 'AUTH_TOKEN') {
    console.log("🔑 [Background] Fresh token received from website");
    
    const token = message.token;
    const session = message.session;
    
    // Decode and log token info
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      const expiresAt = new Date(payload.exp * 1000);
      const now = new Date();
      const minutesUntilExpiry = Math.floor((expiresAt.getTime() - now.getTime()) / 60000);
      
      console.log("⏰ [Background] Token expires in:", minutesUntilExpiry, "minutes");
      console.log("👤 [Background] User:", payload.email);
    } catch (e) {
      console.warn("⚠️ [Background] Could not decode token");
    }
    
    // Store the token (use multiple keys for backward compatibility)
    chrome.storage.local.set({
      wist_auth_token: token,
      wist_session: session,
      wist_last_sync: Date.now(),
      // Also store in legacy keys
      supabase_token: token,
      supabase_session: session
    }, () => {
      if (chrome.runtime.lastError) {
        console.error("❌ [Background] Storage error:", chrome.runtime.lastError);
        sendResponse({ success: false, error: chrome.runtime.lastError.message });
      } else {
        console.log("✅ [Background] Token stored successfully");
        sendResponse({ success: true, message: 'Token updated' });
      }
    });
    
    return true;
  }
  
  // Handle legacy format for backward compatibility
  if (message.action === "SYNC_TOKEN" || message.type === "WIST_AUTH_TOKEN") {
    const token = message.token;
    
    if (token) {
      chrome.storage.local.set({ 
        'wist_auth_token': token,
        'supabase_token': token,
        wist_last_sync: Date.now()
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

// ============================================================================
// TOKEN RETRIEVAL HELPER
// ============================================================================

async function getValidToken() {
  const stored = await chrome.storage.local.get([
    'wist_auth_token',
    'wist_session',
    'wist_last_sync',
    // Legacy keys
    'supabase_token',
    'supabase_session'
  ]);
  
  // Try new keys first
  let token = stored.wist_auth_token;
  let tokenSource = 'wist_auth_token';
  
  // Fall back to legacy keys
  if (!token && stored.supabase_token) {
    token = stored.supabase_token;
    tokenSource = 'supabase_token (legacy)';
  }
  
  // Try extracting from session
  if (!token && stored.wist_session) {
    const session = typeof stored.wist_session === 'string' 
      ? JSON.parse(stored.wist_session) 
      : stored.wist_session;
    token = session.access_token || session.token;
    tokenSource = 'wist_session';
  }
  
  if (!token && stored.supabase_session) {
    const session = typeof stored.supabase_session === 'string' 
      ? JSON.parse(stored.supabase_session) 
      : stored.supabase_session;
    token = session.access_token || session.token;
    tokenSource = 'supabase_session (legacy)';
  }
  
  if (!token) {
    console.error("❌ [Background] No token found in storage");
    throw new Error("Not logged in. Please visit wishlist.nuvio.cloud and log in.");
  }
  
  console.log("✅ [Background] Found token in", tokenSource);
  
  // Check if token is expired
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    const expiresAt = payload.exp * 1000;
    const now = Date.now();
    
    if (expiresAt < now) {
      console.error("❌ [Background] Token is expired!");
      const minutesAgo = Math.floor((now - expiresAt) / 60000);
      console.error(`   Expired ${minutesAgo} minutes ago`);
      throw new Error("Token expired. Please visit wishlist.nuvio.cloud to refresh.");
    }
    
    const minutesUntilExpiry = Math.floor((expiresAt - now) / 60000);
    console.log("✅ [Background] Token is valid, expires in:", minutesUntilExpiry, "minutes");
    
    // Warn if token is about to expire
    if (minutesUntilExpiry < 5) {
      console.warn("⚠️ [Background] Token expires soon! Please refresh the website.");
    }
    
  } catch (e) {
    if (e.message?.includes('expired')) {
      throw e; // Re-throw expiration errors
    }
    console.warn("⚠️ [Background] Could not validate token expiry:", e.message);
  }
  
  return token;
}

// ============================================================================
// MESSAGE HANDLERS
// ============================================================================

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
    getValidToken()
      .then(token => sendResponse({ success: true, token }))
      .catch(error => sendResponse({ success: false, error: error.message }));
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

// ============================================================================
// PREVIEW LINK HANDLER
// ============================================================================

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

// ============================================================================
// SAVE ITEM FUNCTION
// ============================================================================

async function handleSaveItem(payload, sendResponse) {
  try {
    console.log("💾 [Background] Saving item...");
    console.log("🔵 [Extension] Save Request Received", payload);
    
    // Get valid token (with expiration check)
    const token = await getValidToken();
    
    console.log("✅ [Extension] Token extracted, length:", token.length);
    console.log("🔑 [Extension] Token preview:", token.substring(0, 20) + "...");

    // Prepare payload
    const apiPayload = {
      url: payload.url,
      title: payload.title || "Untitled",
      price: parseFloat(payload.price) || 0,
      image_url: payload.image_url || "",
      retailer: payload.retailer || "Unknown",
      note: payload.note || "",
      collection_id: payload.collection_id || null, // Pass through collection_id (null for auto-categorization)
      is_public: payload.is_public !== undefined ? Boolean(payload.is_public) : false // Pass through privacy setting
    };

    console.log("📦 [Extension] Payload:", JSON.stringify(apiPayload, null, 2));
    console.log("🌐 [Extension] Sending to:", `${API_BASE_URL}/api/items`);

    // Make API request
    const response = await fetch(`${API_BASE_URL}/api/items`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}` // <--- Critical Header
      },
      body: JSON.stringify(apiPayload)
    });

    console.log("📡 [Extension] Response status:", response.status);

    // Handle response
    const result = await response.json();
    
    if (!response.ok) {
      console.error("❌ [Extension] API Error:", result);
      
      // If token expired, give helpful message
      if (response.status === 401 && result.error?.includes('expired')) {
        throw new Error("Token expired. Please open wishlist.nuvio.cloud in a new tab to refresh.");
      }
      
      throw new Error(result.error || `Server error: ${response.status}`);
    }

    console.log("✅ [Background] Item saved successfully");
    console.log("✅ [Extension] Save Success:", result);
    sendResponse({ success: true, data: result });

  } catch (error) {
    console.error("❌ [Background] Save failed:", error.message);
    console.error("❌ [Extension] Failed:", error.message);
    console.error("❌ [Extension] Full error:", error);
    sendResponse({ success: false, error: error.message });
  }
}

// ============================================================================
// TOKEN STATUS MONITOR (Helpful for debugging)
// ============================================================================

setInterval(async () => {
  try {
    const stored = await chrome.storage.local.get(['wist_auth_token', 'wist_last_sync']);
    
    if (stored.wist_auth_token) {
      const payload = JSON.parse(atob(stored.wist_auth_token.split('.')[1]));
      const expiresAt = payload.exp * 1000;
      const now = Date.now();
      const lastSync = stored.wist_last_sync || 0;
      
      const minutesUntilExpiry = Math.floor((expiresAt - now) / 60000);
      const minutesSinceSync = Math.floor((now - lastSync) / 60000);
      
      if (minutesUntilExpiry < 0) {
        console.warn(`⚠️ [Background] Token EXPIRED ${-minutesUntilExpiry}m ago. Visit website to refresh.`);
      } else if (minutesUntilExpiry < 5) {
        console.warn(`⚠️ [Background] Token expires in ${minutesUntilExpiry}m. Consider refreshing.`);
      } else {
        console.log(`✅ [Background] Token OK (expires in ${minutesUntilExpiry}m, synced ${minutesSinceSync}m ago)`);
      }
    } else {
      console.warn("⚠️ [Background] No token stored. Please log in at wishlist.nuvio.cloud");
    }
  } catch (e) {
    // Silent fail - this is just for monitoring
  }
}, 5 * 60 * 1000); // Check every 5 minutes
