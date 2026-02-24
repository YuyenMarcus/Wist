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

const SUPABASE_PROJECT_REF = "ulmhmjqjtebaetocuhno";
const SUPABASE_URL = "https://ulmhmjqjtebaetocuhno.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVsbWhtanFqdGViYWV0b2N1aG5vIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUzOTUzMDMsImV4cCI6MjA4MDk3MTMwM30.DRQ2gESK6Yj8_2tUXReid1VoBdyq5qcxT84HsoPp69U";

async function refreshWithSupabase(refreshToken) {
  try {
    console.log("🔄 [Background] Refreshing token via Supabase API...");
    const response = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_ANON_KEY
      },
      body: JSON.stringify({ refresh_token: refreshToken })
    });

    if (!response.ok) {
      console.error("❌ [Background] Supabase refresh failed:", response.status);
      return null;
    }

    const data = await response.json();
    if (!data.access_token) return null;

    const payload = JSON.parse(atob(data.access_token.split('.')[1]));
    const minutesLeft = Math.floor((payload.exp * 1000 - Date.now()) / 60000);
    console.log(`✅ [Background] Token refreshed via Supabase API (${minutesLeft}m left)`);

    await chrome.storage.local.set({
      wist_auth_token: data.access_token,
      wist_session: data,
      wist_last_sync: Date.now(),
      supabase_token: data.access_token,
      supabase_session: data
    });

    return data.access_token;
  } catch (e) {
    console.error("❌ [Background] Supabase refresh error:", e.message);
    return null;
  }
}

function safeBase64Decode(str) {
  let b64 = str.replace(/-/g, '+').replace(/_/g, '/');
  const pad = (4 - (b64.length % 4)) % 4;
  b64 += '='.repeat(pad);
  return atob(b64);
}

async function getTokenFromCookies() {
  try {
    const cookies = await chrome.cookies.getAll({ domain: 'wishlist.nuvio.cloud' });
    const rootCookies = await chrome.cookies.getAll({ domain: '.nuvio.cloud' });
    const seen = new Set();
    const allCookies = [...cookies, ...rootCookies].filter(c => {
      if (seen.has(c.name)) return false;
      seen.add(c.name);
      return true;
    });

    const authCookieName = `sb-${SUPABASE_PROJECT_REF}-auth-token`;

    const authCookies = allCookies
      .filter(c => {
        if (c.name === authCookieName) return true;
        if (c.name.startsWith(authCookieName + '.') && /\.\d+$/.test(c.name)) return true;
        return false;
      })
      .sort((a, b) => a.name.localeCompare(b.name));

    console.log(`🔍 [Background] Found ${authCookies.length} auth cookies:`, authCookies.map(c => c.name));

    if (authCookies.length === 0) return null;

    // Log each cookie for debugging
    authCookies.forEach((c, i) => {
      let val = c.value;
      try { val = decodeURIComponent(val); } catch (_) {}
      console.log(`🔍 [Background] Cookie ${i} "${c.name}": length=${val.length}, starts="${val.substring(0, 30)}..."`);
    });

    // Determine if we have chunked cookies (.0, .1, ...) vs a single base cookie
    const chunkedCookies = authCookies.filter(c => /\.\d+$/.test(c.name));
    const baseCookie = authCookies.find(c => c.name === authCookieName);

    // Prefer chunked cookies if they exist (Supabase SSR standard)
    const cookiesToUse = chunkedCookies.length > 0 ? chunkedCookies : (baseCookie ? [baseCookie] : authCookies);

    // Step 1: URL-decode each cookie value individually, strip "base64-" prefix from first chunk
    const rawChunks = cookiesToUse.map((c, i) => {
      let val = c.value;
      try { val = decodeURIComponent(val); } catch (_) {}
      if (i === 0 && val.startsWith('base64-')) val = val.slice(7);
      return val;
    });

    const combined = rawChunks.join('');
    console.log(`🔍 [Background] Combined base64 length: ${combined.length}`);

    let session = null;

    // Try direct JSON parse (in case it's not encoded)
    try { session = JSON.parse(combined); } catch (_) {}

    // Try base64 decode (handles both standard and URL-safe base64)
    if (!session) {
      try {
        const decoded = safeBase64Decode(combined);
        session = JSON.parse(decoded);
        console.log("✅ [Background] Parsed via base64 decode");
      } catch (e) {
        console.warn("⚠️ [Background] base64 decode failed:", e.message);
      }
    }

    // Try: maybe each chunk has its own "base64-" prefix
    if (!session && chunkedCookies.length > 1) {
      try {
        const chunks = cookiesToUse.map(c => {
          let val = c.value;
          try { val = decodeURIComponent(val); } catch (_) {}
          if (val.startsWith('base64-')) val = val.slice(7);
          return val;
        });
        const decoded = safeBase64Decode(chunks.join(''));
        session = JSON.parse(decoded);
        console.log("✅ [Background] Parsed via per-chunk base64- strip");
      } catch (_) {}
    }

    if (!session) {
      console.warn("⚠️ [Background] All parse strategies failed. Combined first 120 chars:", combined.substring(0, 120));
      // Last resort: try to extract access_token directly from the raw base64
      try {
        const decoded = safeBase64Decode(combined);
        const tokenMatch = decoded.match(/"access_token"\s*:\s*"([^"]+)"/);
        if (tokenMatch) {
          console.log("✅ [Background] Extracted access_token via regex from partial decode");
          const token = tokenMatch[1];
          const payload = JSON.parse(atob(token.split('.')[1]));
          if (payload.exp * 1000 > Date.now()) {
            await chrome.storage.local.set({ wist_auth_token: token, wist_last_sync: Date.now() });
            return token;
          }
        }
      } catch (_) {}
      return null;
    }

    if (!session?.access_token) {
      console.log("⚠️ [Background] Cookie session missing access_token");
      return null;
    }

    const payload = JSON.parse(atob(session.access_token.split('.')[1]));
    const expiresAt = payload.exp * 1000;

    if (expiresAt < Date.now()) {
      console.warn("⚠️ [Background] Cookie access_token expired, trying refresh...");
      if (session.refresh_token) {
        return await refreshWithSupabase(session.refresh_token);
      }
      return null;
    }

    const minutesLeft = Math.floor((expiresAt - Date.now()) / 60000);
    console.log(`✅ [Background] Got valid token from cookies (${minutesLeft}m left)`);

    await chrome.storage.local.set({
      wist_auth_token: session.access_token,
      wist_session: session,
      wist_last_sync: Date.now(),
      supabase_token: session.access_token,
      supabase_session: session
    });

    return session.access_token;
  } catch (e) {
    console.error("❌ [Background] Cookie token read failed:", e.message);
    return null;
  }
}

async function getValidToken() {
  const stored = await chrome.storage.local.get([
    'wist_auth_token',
    'wist_session',
    'wist_last_sync',
    'supabase_token',
    'supabase_session'
  ]);
  
  let token = stored.wist_auth_token;
  let tokenSource = 'wist_auth_token';
  
  if (!token && stored.supabase_token) {
    token = stored.supabase_token;
    tokenSource = 'supabase_token (legacy)';
  }
  
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
  
  // No stored token — try cookies
  if (!token) {
    console.log("⚠️ [Background] No stored token, trying cookies...");
    const cookieToken = await getTokenFromCookies();
    if (cookieToken) return cookieToken;
    throw new Error("Not logged in. Please visit wishlist.nuvio.cloud and log in.");
  }
  
  console.log("✅ [Background] Found token in", tokenSource);
  
  // Check if token is expired
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    const expiresAt = payload.exp * 1000;
    const now = Date.now();
    
    if (expiresAt < now) {
      const minutesAgo = Math.floor((now - expiresAt) / 60000);
      console.warn(`⚠️ [Background] Stored token expired ${minutesAgo}m ago, trying cookies...`);
      const cookieToken = await getTokenFromCookies();
      if (cookieToken) return cookieToken;
      throw new Error("Token expired. Please visit wishlist.nuvio.cloud to refresh.");
    }
    
    const minutesUntilExpiry = Math.floor((expiresAt - now) / 60000);
    console.log("✅ [Background] Token valid, expires in:", minutesUntilExpiry, "minutes");
    
    if (minutesUntilExpiry < 5) {
      console.log("🔄 [Background] Token expiring soon, proactively refreshing from cookies...");
      const cookieToken = await getTokenFromCookies();
      if (cookieToken) return cookieToken;
    }
    
  } catch (e) {
    if (e.message?.includes('expired') || e.message?.includes('Not logged in')) {
      throw e;
    }
    console.warn("⚠️ [Background] Could not validate token expiry:", e.message);
  }
  
  return token;
}

// ============================================================================
// MESSAGE HANDLERS
// ============================================================================

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  // Handle AUTH_TOKEN relayed from content script (works without hardcoded extension ID)
  if (request.type === 'AUTH_TOKEN' && request.token) {
    console.log("🔑 [Background] Token received via content script relay");
    const token = request.token;
    const session = request.session;

    chrome.storage.local.set({
      wist_auth_token: token,
      wist_session: session,
      wist_last_sync: Date.now(),
      supabase_token: token,
      supabase_session: session
    }, () => {
      if (chrome.runtime.lastError) {
        sendResponse({ success: false, error: chrome.runtime.lastError.message });
      } else {
        console.log("✅ [Background] Token stored via content script relay");
        sendResponse({ success: true });
      }
    });
    return true;
  }

  if (request.action === "PREVIEW_LINK") {
    console.log("🔒 WIST: Preview requested for", request.url);
    handlePreviewLink(request.url, sendResponse).catch(error => {
      console.error("❌ [Background] Preview error:", error);
      sendResponse({ success: false, error: error.message });
    });
    return true; // Keep channel open for async response
  }

  // Handle SCRAPE_URL_FOR_WEBAPP - browser-based scraping for the dashboard
  if (request.action === "SCRAPE_URL_FOR_WEBAPP") {
    console.log("🧩 [Background] Webapp scrape request for:", request.url);
    handleWebappScrape(request.url, sendResponse).catch(error => {
      console.error("❌ [Background] Webapp scrape error:", error);
      sendResponse({ success: false, error: error.message });
    });
    return true; // Keep channel open for async response
  }

  if (request.action === "TRIGGER_PURCHASE_POPUP") {
    chrome.tabs.sendMessage(sender.tab.id, {
      action: "TRIGGER_PURCHASE_POPUP",
      url: request.url
    }).catch(() => {});
    // No response needed for this action
    return false;
  }

  if (request.action === "GET_USER_TOKEN" || request.type === "GET_TOKEN") {
    // Content script or popup is asking for the token
    getValidToken()
      .then(token => {
        sendResponse({ success: true, token });
      })
      .catch(error => {
        sendResponse({ success: false, error: error.message });
      });
    return true; // Keep channel open for async response
  }

  // Handle SAVE_ITEM from popup.js (uses request.action and request.data)
  if (request.action === "SAVE_ITEM") {
    console.log("💾 WIST: Save Request", request.data);
    handleSaveItem(request.data, sendResponse).catch(error => {
      console.error("❌ [Background] Save error (unhandled):", error);
      sendResponse({ success: false, error: error.message || 'Unknown error' });
    });
    return true; // Keep channel open for async response
  }

  // Handle SAVE_ITEM from content.js (uses request.type and request.payload)
  if (request.type === 'SAVE_ITEM') {
    handleSaveItem(request.payload, sendResponse).catch(error => {
      console.error("❌ [Background] Save error (unhandled):", error);
      sendResponse({ success: false, error: error.message || 'Unknown error' });
    });
    return true; // Keep channel open for async response
  }

  // Handle PRICE_DROP_NOTIFICATION from website
  if (request.type === 'PRICE_DROP_NOTIFICATION') {
    console.log("🔔 [Background] Price drop notification received:", request.notifications);
    handlePriceDropNotifications(request.notifications).catch(error => {
      console.error("❌ [Background] Notification error:", error);
    });
    // No response needed for notifications
    return false;
  }
  
  // If no handler matched, return false
  return false;
});

// ============================================================================
// WEBAPP SCRAPE HANDLER - Browser-based scraping for dashboard "paste link"
// ============================================================================

async function handleWebappScrape(productUrl, sendResponse) {
  console.log("🧩 [Background] Starting browser-based scrape for:", productUrl);
  
  let backgroundTab = null;
  
  // JS-heavy sites need more render time
  const hostname = new URL(productUrl).hostname.toLowerCase();
  let jsRenderDelay = 2000;
  if (hostname.includes('target.')) jsRenderDelay = 5000;
  else if (hostname.includes('walmart.')) jsRenderDelay = 4000;
  else if (hostname.includes('bestbuy.')) jsRenderDelay = 4000;
  else if (hostname.includes('etsy.')) jsRenderDelay = 4000;
  else if (hostname.includes('taobao.') || hostname.includes('tmall.') || hostname.includes('1688.')) jsRenderDelay = 6000;
  else if (hostname.includes('kakobuy.') || hostname.includes('superbuy.') || hostname.includes('wegobuy.') || hostname.includes('pandabuy.') || hostname.includes('cssbuy.')) jsRenderDelay = 5000;
  
  try {
    backgroundTab = await chrome.tabs.create({
      url: productUrl,
      active: false,
    });
    
    console.log("📑 [Background] Created background tab:", backgroundTab.id, `(render delay: ${jsRenderDelay}ms)`);
    
    // Wait for the page to fully load
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Page load timeout'));
      }, 45000);
      
      const checkComplete = async () => {
        try {
          const tab = await chrome.tabs.get(backgroundTab.id);
          if (tab.status === 'complete') {
            clearTimeout(timeout);
            setTimeout(resolve, jsRenderDelay);
          } else {
            setTimeout(checkComplete, 500);
          }
        } catch (e) {
          clearTimeout(timeout);
          reject(e);
        }
      };
      
      checkComplete();
    });
    
    console.log("✅ [Background] Page loaded, executing scraper...");
    
    // Execute the scraping script in the tab
    const results = await chrome.scripting.executeScript({
      target: { tabId: backgroundTab.id },
      func: scrapePageData,
    });
    
    console.log("📦 [Background] Scrape results:", results);
    
    // Close the background tab
    await chrome.tabs.remove(backgroundTab.id);
    backgroundTab = null;
    
    if (results && results[0] && results[0].result) {
      const data = results[0].result;
      
      // Target fallback: if no price was found, try the Redsky API
      if ((!data.price || data.price === 0) && productUrl.includes('target.com')) {
        console.log("🎯 [Background] Target price missing, trying Redsky API...");
        try {
          const tcinMatch = productUrl.match(/\/A-(\d+)/);
          if (tcinMatch) {
            const tcin = tcinMatch[1];
            const apiUrl = `https://redsky.target.com/redsky_aggregations/v1/web/pdp_client_v1?key=9f36aeafbe60771e321a7cc95a78140772ab3e96&tcin=${tcin}&pricing_store_id=3991&has_pricing_store_id=true`;
            const apiRes = await fetch(apiUrl);
            if (apiRes.ok) {
              const apiData = await apiRes.json();
              const priceObj = apiData?.data?.product?.price;
              const retail = priceObj?.current_retail || priceObj?.reg_retail;
              if (retail) {
                data.price = retail;
                console.log("✅ [Background] Got Target price from Redsky API:", retail);
              }
            }
          }
        } catch (e) {
          console.warn("⚠️ [Background] Redsky API failed:", e.message);
        }
      }

      console.log("✅ [Background] Successfully scraped:", data.title, "price:", data.price);
      sendResponse({ success: true, data });
    } else {
      throw new Error('No data returned from scraper');
    }
    
  } catch (error) {
    console.error("❌ [Background] Scrape failed:", error);
    
    // Make sure to close the tab on error
    if (backgroundTab && backgroundTab.id) {
      try {
        await chrome.tabs.remove(backgroundTab.id);
      } catch (e) {
        // Tab might already be closed
      }
    }
    
    sendResponse({ success: false, error: error.message });
  }
}

// This function runs in the context of the scraped page
function scrapePageData() {
  const url = window.location.href;
  const domain = window.location.hostname.toLowerCase();
  
  console.log('🔍 [Scraper] Scraping page:', url);
  
  let title = null;
  let price = null;
  let image = null;
  let description = null;
  
  // ===== AMAZON =====
  if (domain.includes('amazon.')) {
    // Title
    const titleSelectors = ['#productTitle', '#title', 'h1.a-size-large', 'span#productTitle'];
    for (const sel of titleSelectors) {
      const el = document.querySelector(sel);
      if (el && el.textContent?.trim()) {
        title = el.textContent.trim();
        break;
      }
    }
    
    // Price - priority order
    const priceSelectors = [
      '.priceToPay .a-offscreen',
      '.priceToPay span.a-offscreen',
      '#corePrice_desktop .priceToPay .a-offscreen',
      '.apexPriceToPay .a-offscreen',
      '#priceblock_dealprice',
      '#priceblock_saleprice',
      '#priceblock_ourprice',
      '#price_inside_buybox',
      '#corePrice_feature_div .a-price:not(.a-text-price) .a-offscreen',
      '#corePriceDisplay_desktop_feature_div .a-price:not(.a-text-price) .a-offscreen',
      '.a-price:not(.a-text-price) .a-offscreen',
    ];
    for (const sel of priceSelectors) {
      const el = document.querySelector(sel);
      if (el) {
        const text = el.textContent?.trim() || el.innerText?.trim();
        if (text && /\d/.test(text)) {
          price = text;
          break;
        }
      }
    }
    
    // Image
    const imageSelectors = ['#landingImage', '#imgBlkFront', '#main-image'];
    for (const sel of imageSelectors) {
      const el = document.querySelector(sel);
      if (el && (el.src || el.getAttribute('data-old-hires'))) {
        image = el.getAttribute('data-old-hires') || el.src;
        break;
      }
    }
    
    // Description
    const descEl = document.querySelector('#productDescription p, #feature-bullets ul');
    if (descEl) description = descEl.textContent?.trim().substring(0, 500);
  }
  
  // ===== ETSY =====
  else if (domain.includes('etsy.')) {
    const titleEl = document.querySelector('h1[data-buy-box-listing-title], h1');
    if (titleEl) title = titleEl.textContent?.trim();
    
    const priceEl = document.querySelector('[data-buy-box-region="price"] p, .wt-text-title-larger');
    if (priceEl) price = priceEl.textContent?.trim();
    
    const imageEl = document.querySelector('[data-carousel-paging] img, .listing-page-image-carousel img');
    if (imageEl) image = imageEl.src;
    
    const descEl = document.querySelector('[data-id="description-text"]');
    if (descEl) description = descEl.textContent?.trim().substring(0, 500);
  }
  
  // ===== TARGET =====
  else if (domain.includes('target.')) {
    const titleSelectors = [
      'h1[data-test="product-title"]',
      '[data-test="product-detail-highlights"] h1',
      'h1.Heading',
      'h1[class*="ProductTitle"]',
      'h1',
    ];
    for (const sel of titleSelectors) {
      const el = document.querySelector(sel);
      if (el && el.textContent?.trim()) {
        title = el.textContent.trim();
        break;
      }
    }
    
    // Target price: DOM selectors (current-price is the correct data-test attr)
    const priceSelectors = [
      'span[data-test="current-price"]',
      'span[data-test="current-price"] span',
      '[data-test="product-price"]',
      '[data-test="product-price"] span',
      '[class*="CurrentPrice"]',
      '[class*="CurrentPrice"] span',
      '[class*="styles__CurrentPriceFontSize"]',
    ];
    for (const sel of priceSelectors) {
      const el = document.querySelector(sel);
      if (el) {
        const text = el.textContent?.trim();
        if (text && /\$\d/.test(text)) {
          price = text;
          break;
        }
      }
    }

    // Target price: scan elements with "price" in data-test or class
    if (!price) {
      const candidates = document.querySelectorAll('[data-test*="rice"], [class*="rice"], [class*="Rice"]');
      for (const el of candidates) {
        const text = el.textContent?.trim();
        if (text && /^\$\d{1,5}(\.\d{2})?$/.test(text)) {
          price = text;
          break;
        }
      }
    }

    // Target price: extract from embedded script data
    if (!price) {
      try {
        const allText = document.documentElement.innerHTML;
        const patterns = [
          /"current_retail"\s*:\s*([0-9]+\.?[0-9]*)/,
          /"formatted_current_price"\s*:\s*"\$([0-9.,]+)"/,
          /"current_retail_min"\s*:\s*([0-9]+\.?[0-9]*)/,
          /"price"\s*:\s*\{\s*"[^"]*"\s*:\s*"[^"]*"\s*,\s*"currentRetail"\s*:\s*([0-9.]+)/,
          /"offerPrice"\s*:\s*\{[^}]*?"price"\s*:\s*([0-9.]+)/,
        ];
        for (const pattern of patterns) {
          const match = allText.match(pattern);
          if (match && match[1]) {
            const val = parseFloat(match[1].replace(/,/g, ''));
            if (val >= 0.01 && val <= 100000) {
              price = match[1];
              break;
            }
          }
        }
      } catch (e) {}
    }

    // Target price: find visible $XX.XX in the top portion of the page
    if (!price) {
      const allElements = document.querySelectorAll('span, div, p');
      for (const el of allElements) {
        if (el.children.length > 3) continue;
        const text = el.textContent?.trim();
        if (text && /^\$\d{1,5}\.\d{2}$/.test(text)) {
          const rect = el.getBoundingClientRect();
          if (rect.top > 0 && rect.top < 900 && rect.width > 0) {
            price = text;
            break;
          }
        }
      }
    }

    const imageSelectors = [
      '[data-test="product-image"] img',
      'img[data-test="product-image"]',
      '[class*="slide--active"] img',
      'picture img[src*="target"]',
      'img[alt][src*="scene7"]',
    ];
    for (const sel of imageSelectors) {
      const el = document.querySelector(sel);
      if (el && el.src) {
        image = el.src;
        break;
      }
    }
    
    const descEl = document.querySelector('[data-test="item-details-description"], [class*="Description"]');
    if (descEl) description = descEl.textContent?.trim().substring(0, 500);
  }
  
  // ===== WALMART =====
  else if (domain.includes('walmart.')) {
    const titleEl = document.querySelector('h1[itemprop="name"], h1');
    if (titleEl) title = titleEl.textContent?.trim();
    
    const priceEl = document.querySelector('[itemprop="price"]');
    if (priceEl) price = priceEl.textContent?.trim() || priceEl.getAttribute('content');
    
    const imageEl = document.querySelector('[data-testid="hero-image"] img');
    if (imageEl) image = imageEl.src;
  }
  
  // ===== BEST BUY =====
  else if (domain.includes('bestbuy.')) {
    const titleEl = document.querySelector('h1.heading-5');
    if (titleEl) title = titleEl.textContent?.trim();
    
    const priceEl = document.querySelector('.priceView-customer-price span');
    if (priceEl) price = priceEl.textContent?.trim();
    
    const imageEl = document.querySelector('img.primary-image');
    if (imageEl) image = imageEl.src;
  }
  
  // ===== TAOBAO / TMALL / 1688 =====
  else if (domain.includes('taobao.') || domain.includes('tmall.') || domain.includes('1688.')) {
    const titleSelectors = [
      'h3.tb-main-title', '.tb-detail-hd h1', '.ItemHeader--mainTitle',
      'h1[data-title]', '.tb-main-title', '.d-title',
      '[class*="ItemHeader"] h1', '[class*="title--"] h3'
    ];
    for (const sel of titleSelectors) {
      const el = document.querySelector(sel);
      if (el) {
        title = el.getAttribute('data-title') || el.textContent?.trim();
        if (title) break;
      }
    }
    if (!title) {
      const ogT = document.querySelector('meta[property="og:title"]');
      if (ogT) title = ogT.getAttribute('content');
    }

    const priceSelectors = [
      '.tb-rmb-num', '.tm-price', '.tm-promo-price .tm-price',
      '[class*="Price--current"]', '[class*="price--current"]',
      '.tb-rmb', '#J_PromoPriceNum', '#J_StrPriceModBox .tb-rmb-num'
    ];
    for (const sel of priceSelectors) {
      const el = document.querySelector(sel);
      if (el) {
        const text = el.textContent?.trim();
        if (text && /[\d.]+/.test(text)) {
          price = '¥' + text.replace(/[^\d.]/g, '');
          break;
        }
      }
    }
    if (!price) {
      try {
        const html = document.documentElement.innerHTML;
        const patterns = [/"price"\s*:\s*"?([\d.]+)"?/, /"promotionPrice"\s*:\s*"?([\d.]+)"?/];
        for (const p of patterns) {
          const m = html.match(p);
          if (m && m[1] && parseFloat(m[1]) > 0) { price = '¥' + m[1]; break; }
        }
      } catch (e) {}
    }

    const imageSelectors = [
      '#J_ImgBooth', '.tb-booth img', '[class*="PicGallery"] img',
      'img[data-src*="alicdn"]'
    ];
    for (const sel of imageSelectors) {
      const el = document.querySelector(sel);
      if (el) {
        const src = el.getAttribute('data-src') || el.src;
        if (src && !src.includes('placeholder')) {
          image = src.startsWith('//') ? 'https:' + src : src;
          break;
        }
      }
    }
    if (!image) {
      const ogI = document.querySelector('meta[property="og:image"]');
      if (ogI) image = ogI.getAttribute('content');
    }

    const ogD = document.querySelector('meta[property="og:description"], meta[name="description"]');
    if (ogD) description = ogD.getAttribute('content')?.substring(0, 500);
  }

  // ===== AGENT SITES (Kakobuy, Superbuy, Wegobuy, Pandabuy, CSSBuy) =====
  else if (domain.includes('kakobuy.') || domain.includes('superbuy.') || domain.includes('wegobuy.') || domain.includes('pandabuy.') || domain.includes('cssbuy.')) {
    const titleSelectors = [
      '[class*="goodsName"]', '[class*="goods-name"]', '[class*="GoodsName"]',
      '[class*="goodsTitle"]', '[class*="goods-title"]', '[class*="GoodsTitle"]',
      '[class*="product-name"]', '[class*="productName"]', '[class*="ProductName"]',
      '[class*="product-title"]', '[class*="productTitle"]', '[class*="ProductTitle"]',
      '[class*="item-name"]', '[class*="itemName"]', '[class*="ItemName"]',
      '[class*="item-title"]', '[class*="itemTitle"]', '[class*="ItemTitle"]',
      '[class*="detail-title"]', '[class*="detailTitle"]',
      '[class*="info-name"]', '[class*="infoName"]',
      '.goods-title', '.product-title', '.item-title',
      'h1', 'h2',
    ];
    for (const sel of titleSelectors) {
      try {
        const els = document.querySelectorAll(sel);
        for (const el of els) {
          const text = el.textContent?.trim();
          if (text && text.length > 8 && text.length < 500 &&
              !/^(Home|Shop|Cart|Login|Kakobuy|Detail|Loading)/i.test(text)) {
            title = text;
            break;
          }
        }
        if (title) break;
      } catch (e) {}
    }
    if (!title) {
      let best = null; let bestLen = 0;
      const cands = document.querySelectorAll('h1, h2, h3, [class*="title"], [class*="name"], [class*="Title"], [class*="Name"]');
      for (const el of cands) {
        const text = el.textContent?.trim();
        if (text && text.length > 10 && text.length < 300 && text.length > bestLen &&
            !/kakobuy|superbuy|wegobuy|pandabuy|cssbuy|login|register|cart|home/i.test(text)) {
          best = text; bestLen = text.length;
        }
      }
      if (best) title = best;
    }
    if (!title) {
      const cleaned = (document.title || '').replace(/[-|–]\s*(Kakobuy|Superbuy|Wegobuy|Pandabuy|CSSBuy).*/i, '').trim();
      if (cleaned.length > 5) title = cleaned;
    }
    if (!title) {
      const ogT = document.querySelector('meta[property="og:title"]');
      if (ogT) title = ogT.getAttribute('content');
    }
    if (!title) {
      try {
        const html = document.documentElement.innerHTML;
        const patterns = [/"goodsName"\s*:\s*"([^"]+)"/, /"goods_name"\s*:\s*"([^"]+)"/, /"productName"\s*:\s*"([^"]+)"/, /"title"\s*:\s*"([^"]{10,200})"/];
        for (const p of patterns) {
          const m = html.match(p);
          if (m && m[1] && m[1].length > 5) { title = m[1]; break; }
        }
      } catch (e) {}
    }

    const priceSelectors = [
      '[class*="price"]', '[class*="Price"]', '.goods-price',
      '.product-price', '.item-price', '.sale-price'
    ];
    for (const sel of priceSelectors) {
      const els = document.querySelectorAll(sel);
      for (const el of els) {
        const text = el.textContent?.trim();
        if (text && /[\d.]+/.test(text) && text.length < 30) { price = text; break; }
      }
      if (price) break;
    }

    const imageSelectors = [
      '[class*="mainImage"] img', '[class*="MainImage"] img',
      '[class*="goodsImage"] img', '[class*="goods-image"] img',
      '[class*="product-image"] img', '[class*="productImage"] img',
      '[class*="gallery"] img', '[class*="Gallery"] img',
      '.swiper-slide img', 'img[src*="cbu01.alicdn"]', 'img[src*="img.alicdn"]',
      '.product-image img', '.goods-image img',
    ];
    for (const sel of imageSelectors) {
      const el = document.querySelector(sel);
      if (el) {
        const src = el.getAttribute('data-src') || el.src;
        if (src && !src.includes('placeholder') && !src.includes('svg') && !src.includes('logo')) {
          image = src.startsWith('//') ? 'https:' + src : src;
          break;
        }
      }
    }
    if (!image) {
      const ogI = document.querySelector('meta[property="og:image"]');
      if (ogI) image = ogI.getAttribute('content');
    }
    if (!image) {
      const allImgs = document.querySelectorAll('img');
      let bestImg = null; let bestSize = 0;
      for (const img of allImgs) {
        const sz = (img.naturalWidth || img.width || 0) * (img.naturalHeight || img.height || 0);
        if (sz > bestSize && !img.src.includes('logo') && !img.src.includes('icon') && img.src.length > 10) {
          bestImg = img.src; bestSize = sz;
        }
      }
      if (bestImg) image = bestImg;
    }

    const ogD = document.querySelector('meta[property="og:description"], meta[name="description"]');
    if (ogD) description = ogD.getAttribute('content')?.substring(0, 500);
  }

  // ===== GENERIC =====
  else {
    // Title from meta tags
    const ogTitle = document.querySelector('meta[property="og:title"]');
    const h1 = document.querySelector('h1');
    title = ogTitle?.getAttribute('content') || h1?.textContent?.trim() || document.title;
    
    // Price from JSON-LD
    const jsonLdScripts = document.querySelectorAll('script[type="application/ld+json"]');
    for (const script of jsonLdScripts) {
      try {
        const data = JSON.parse(script.textContent || '{}');
        const items = Array.isArray(data) ? data : [data];
        for (const item of items) {
          if (item['@type'] === 'Product' || item['@type'] === 'Offer') {
            const p = item.offers?.price || item.price;
            if (p) {
              price = p.toString();
              break;
            }
          }
        }
        if (price) break;
      } catch (e) {}
    }
    
    // Image from meta
    const ogImage = document.querySelector('meta[property="og:image"]');
    image = ogImage?.getAttribute('content');
    
    // Description from meta
    const ogDesc = document.querySelector('meta[property="og:description"]');
    description = ogDesc?.getAttribute('content');
  }
  
  // ===== UNIVERSAL FALLBACKS (run for ALL sites if data is still missing) =====
  
  // JSON-LD structured data fallback
  if (!title || !price || !image) {
    const jsonLdScripts = document.querySelectorAll('script[type="application/ld+json"]');
    for (const script of jsonLdScripts) {
      try {
        const data = JSON.parse(script.textContent || '{}');
        const items = Array.isArray(data) ? data : [data];
        for (const item of items) {
          if (item['@type'] === 'Product' || item['@type'] === 'Offer' || item['@graph']) {
            const product = item['@graph']
              ? item['@graph'].find(g => g['@type'] === 'Product')
              : item;
            if (!product) continue;
            if (!title && product.name) title = product.name;
            if (!price) {
              const p = product.offers?.price || product.offers?.lowPrice || product.price;
              if (p !== undefined && p !== null) price = String(p);
            }
            if (!image) {
              const img = product.image;
              if (Array.isArray(img)) image = img[0];
              else if (typeof img === 'string') image = img;
              else if (img?.url) image = img.url;
            }
            if (!description && product.description) {
              description = product.description.substring(0, 500);
            }
          }
        }
      } catch (e) {}
    }
  }
  
  // Meta tag fallbacks
  if (!title) {
    const ogTitle = document.querySelector('meta[property="og:title"]');
    title = ogTitle?.getAttribute('content') || document.title || null;
  }
  if (!image) {
    const ogImage = document.querySelector('meta[property="og:image"]');
    image = ogImage?.getAttribute('content') || null;
  }
  if (!price) {
    const priceMeta = document.querySelector('meta[property="product:price:amount"], meta[property="og:price:amount"]');
    if (priceMeta) price = priceMeta.getAttribute('content');
  }
  if (!description) {
    const ogDesc = document.querySelector('meta[property="og:description"]');
    description = ogDesc?.getAttribute('content') || null;
  }

  // Detect currency from raw price and domain
  let currencyCode = 'USD';
  const priceStr = (price || '').toString();
  if (/¥|￥/.test(priceStr)) {
    currencyCode = (domain.includes('.jp') || domain.includes('rakuten')) ? 'JPY' : 'CNY';
  } else if (/€/.test(priceStr)) currencyCode = 'EUR';
  else if (/£/.test(priceStr)) currencyCode = 'GBP';
  else if (/₩/.test(priceStr)) currencyCode = 'KRW';
  else if (/₹/.test(priceStr)) currencyCode = 'INR';
  else if (/₡/.test(priceStr)) currencyCode = 'CRC';
  else if (/₺/.test(priceStr)) currencyCode = 'TRY';
  else if (/R\$/.test(priceStr)) currencyCode = 'BRL';
  else if (/MX\$/.test(priceStr)) currencyCode = 'MXN';
  else if (/RD\$/.test(priceStr)) currencyCode = 'DOP';
  else if (/CA\$|CAD/.test(priceStr)) currencyCode = 'CAD';
  else if (/A\$|AU\$|AUD/.test(priceStr)) currencyCode = 'AUD';
  else if (/S\//.test(priceStr)) currencyCode = 'PEN';
  else if (/Q\s?\d/.test(priceStr)) currencyCode = 'GTQ';
  else if (/\$/.test(priceStr)) {
    if (domain.includes('.mx') || domain.includes('mercadolibre.com.mx')) currencyCode = 'MXN';
    else if (domain.includes('.ca')) currencyCode = 'CAD';
    else if (domain.includes('.au')) currencyCode = 'AUD';
    else if (domain.includes('.ar')) currencyCode = 'ARS';
    else if (domain.includes('.cl')) currencyCode = 'CLP';
    else if (domain.includes('.do')) currencyCode = 'DOP';
    else if (domain.includes('.ni')) currencyCode = 'NIO';
    else currencyCode = 'USD';
  }
  else if (domain.includes('taobao.') || domain.includes('tmall.') || domain.includes('1688.') ||
           domain.includes('kakobuy.') || domain.includes('superbuy.') || domain.includes('wegobuy.') ||
           domain.includes('pandabuy.') || domain.includes('cssbuy.'))
    currencyCode = 'CNY';
  else if (domain.includes('.jp')) currencyCode = 'JPY';
  else if (domain.includes('.co.uk')) currencyCode = 'GBP';
  else if (domain.includes('.de') || domain.includes('.fr') || domain.includes('.it') || domain.includes('.es') ||
           domain.includes('.nl') || domain.includes('.be') || domain.includes('.at') || domain.includes('.pt'))
    currencyCode = 'EUR';
  else if (domain.includes('.mx')) currencyCode = 'MXN';
  else if (domain.includes('.gt')) currencyCode = 'GTQ';
  else if (domain.includes('.sv')) currencyCode = 'USD';
  else if (domain.includes('.hn')) currencyCode = 'HNL';
  else if (domain.includes('.ni')) currencyCode = 'NIO';
  else if (domain.includes('.cr')) currencyCode = 'CRC';
  else if (domain.includes('.pe')) currencyCode = 'PEN';
  else if (domain.includes('.ar')) currencyCode = 'ARS';
  else if (domain.includes('.cl')) currencyCode = 'CLP';
  else if (domain.includes('.br')) currencyCode = 'BRL';

  // Clean up price
  let priceValue = 0;
  if (price) {
    const priceMatch = price.toString().replace(/[^0-9.]/g, '');
    priceValue = parseFloat(priceMatch) || 0;
  }
  
  return {
    title: title || document.title || 'Unknown Item',
    price: priceValue,
    image: image || null,
    description: description || null,
    url: url,
    retailer: domain.replace('www.', '').replace('m.', '').split('.')[0],
    currency: currencyCode,
    original_price_raw: price || null,
  };
}

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
    // Ensure sendResponse is always called, even on unexpected errors
    if (sendResponse) {
      sendResponse({ success: false, error: error.message || 'Unknown error' });
    }
    throw error; // Re-throw so outer catch can handle it
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
      collection_id: payload.collection_id || null,
      is_public: payload.is_public !== undefined ? Boolean(payload.is_public) : false,
      currency: payload.currency || "USD",
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
    
    // Ensure sendResponse is called
    if (sendResponse) {
      sendResponse({ success: true, data: result });
    }

  } catch (error) {
    console.error("❌ [Background] Save failed:", error.message);
    console.error("❌ [Extension] Failed:", error.message);
    console.error("❌ [Extension] Full error:", error);
    
    // Ensure sendResponse is always called, even on unexpected errors
    if (sendResponse) {
      sendResponse({ success: false, error: error.message || 'Unknown error' });
    }
    
    // Re-throw so outer catch can handle it if needed
    throw error;
  }
}

// ============================================================================
// PRICE DROP NOTIFICATION HANDLER
// ============================================================================

async function handlePriceDropNotifications(notifications) {
  try {
    console.log("🔔 [Background] Processing", notifications.length, "price drop notification(s)");

    // Request notification permission if not already granted
    if (chrome.notifications && chrome.notifications.create) {
      // Show individual notifications or bundled notification
      if (notifications.length === 1) {
        // Single notification
        const notif = notifications[0];
        await showPriceDropNotification(notif);
      } else {
        // Bundle multiple notifications
        await showBundledNotification(notifications);
      }
    } else {
      console.warn("⚠️ [Background] Notifications API not available");
    }
  } catch (error) {
    console.error("❌ [Background] Failed to show notifications:", error);
  }
}

async function showPriceDropNotification(notification) {
  const { itemTitle, itemImage, itemUrl, oldPrice, newPrice, priceChange } = notification;
  
  const priceChangeText = priceChange 
    ? `${Math.abs(priceChange).toFixed(1)}% ${priceChange < 0 ? 'drop' : 'increase'}`
    : 'price change';
  
  const notificationId = `price-drop-${Date.now()}`;
  
  const options = {
    type: 'basic',
    iconUrl: itemImage || chrome.runtime.getURL('icons/icon128.png'),
    title: '💰 Price Drop Alert!',
    message: `${itemTitle}\n$${oldPrice?.toFixed(2)} → $${newPrice?.toFixed(2)} (${priceChangeText})`,
    buttons: [
      { title: 'View Item' }
    ],
    requireInteraction: false,
    priority: 2
  };

  try {
    await chrome.notifications.create(notificationId, options);
    console.log("✅ [Background] Notification shown:", notificationId);
    
    // Handle notification click
    chrome.notifications.onButtonClicked.addListener((id, buttonIndex) => {
      if (id === notificationId && buttonIndex === 0 && itemUrl) {
        chrome.tabs.create({ url: itemUrl });
        chrome.notifications.clear(id);
      }
    });
    
    chrome.notifications.onClicked.addListener((id) => {
      if (id === notificationId && itemUrl) {
        chrome.tabs.create({ url: itemUrl });
        chrome.notifications.clear(id);
      }
    });
  } catch (error) {
    console.error("❌ [Background] Failed to create notification:", error);
  }
}

async function showBundledNotification(notifications) {
  const count = notifications.length;
  const totalSavings = notifications.reduce((sum, n) => {
    const savings = (n.oldPrice || 0) - (n.newPrice || 0);
    return sum + (savings > 0 ? savings : 0);
  }, 0);
  
  const notificationId = `price-drop-bundle-${Date.now()}`;
  
  const options = {
    type: 'basic',
    iconUrl: chrome.runtime.getURL('icons/icon128.png'),
    title: `💰 ${count} Price Drop${count > 1 ? 's' : ''}!`,
    message: totalSavings > 0 
      ? `You could save $${totalSavings.toFixed(2)} on ${count} item${count > 1 ? 's' : ''}`
      : `${count} item${count > 1 ? 's' : ''} have price changes`,
    buttons: [
      { title: 'View Wishlist' }
    ],
    requireInteraction: false,
    priority: 1
  };

  try {
    await chrome.notifications.create(notificationId, options);
    console.log("✅ [Background] Bundled notification shown:", notificationId);
    
    // Handle notification click
    chrome.notifications.onButtonClicked.addListener((id, buttonIndex) => {
      if (id === notificationId && buttonIndex === 0) {
        chrome.tabs.create({ url: `${API_BASE_URL}/dashboard` });
        chrome.notifications.clear(id);
      }
    });
    
    chrome.notifications.onClicked.addListener((id) => {
      if (id === notificationId) {
        chrome.tabs.create({ url: `${API_BASE_URL}/dashboard` });
        chrome.notifications.clear(id);
      }
    });
  } catch (error) {
    console.error("❌ [Background] Failed to create bundled notification:", error);
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
