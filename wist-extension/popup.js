// popup.js - Modern Wist Extension Popup
const API_BASE_URL = "https://wishlist.nuvio.cloud";

// UI Elements
const loadingDiv = document.getElementById('loading');
const previewDiv = document.getElementById('preview');
const successDiv = document.getElementById('success');
const errorDiv = document.getElementById('error');
const errorMsg = document.getElementById('error-msg');
const saveBtn = document.getElementById('save-btn');
const collectionSelector = document.getElementById('collection-selector');
const collectionName = document.getElementById('collection-name');
const collectionDropdown = document.getElementById('collection-dropdown');
const privacyToggle = document.getElementById('privacy-toggle');
const privacyText = document.getElementById('privacy-text');
const privacyIcon = document.getElementById('privacy-icon');

// State
let currentProduct = null;
let collections = [];
let selectedCollectionId = null;
let isPrivate = true;

// Helper to show states
function showState(state) {
  loadingDiv.classList.add('hidden');
  previewDiv.classList.add('hidden');
  successDiv.classList.add('hidden');
  errorDiv.classList.add('hidden');
  
  if (state === 'loading') loadingDiv.classList.remove('hidden');
  if (state === 'preview') previewDiv.classList.remove('hidden');
  if (state === 'success') successDiv.classList.remove('hidden');
  if (state === 'error') errorDiv.classList.remove('hidden');
}

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
  try {
    // 1. Get the Active Tab
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    if (!tab || !tab.url) {
      errorMsg.textContent = "Cannot access this tab.";
      showState('error');
      return;
    }

    // Skip chrome:// and extension pages
    if (tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://')) {
      errorMsg.textContent = "Please navigate to a product page.";
      showState('error');
      return;
    }

    // 2. Load user collections
    await loadCollections();

    // 3. Scrape product data from the page
    try {
      const results = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: scrapeProductData
      });

      const data = results[0].result;
      currentProduct = data;
      
      // 4. Render Preview
      renderPreview(data);
      showState('preview');

    } catch (err) {
      console.error("Client scrape failed:", err);
      errorMsg.textContent = "Could not access page. Try a different page.";
      showState('error');
    }
  } catch (error) {
    console.error("Popup Error:", error);
    errorMsg.textContent = `Error: ${error.message}`;
    showState('error');
  }
});

// Load user collections
async function loadCollections() {
  try {
    // Get token from storage
    const stored = await chrome.storage.local.get(['wist_auth_token', 'wist_session']);
    let token = stored.wist_auth_token;
    
    if (!token && stored.wist_session) {
      const session = typeof stored.wist_session === 'string' 
        ? JSON.parse(stored.wist_session) 
        : stored.wist_session;
      token = session.access_token || session.token;
    }

    if (!token) {
      console.warn("No token found, collections will be empty");
      return;
    }

    // Fetch collections from API
    const response = await fetch(`${API_BASE_URL}/api/collections`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (response.ok) {
      const result = await response.json();
      collections = result.collections || [];
      
      // Set default collection (first one or null for "General")
      if (collections.length > 0) {
        selectedCollectionId = collections[0].id;
        collectionName.textContent = collections[0].name;
      } else {
        selectedCollectionId = null;
        collectionName.textContent = 'General Wishlist';
      }
    } else {
      console.warn("Failed to load collections:", response.status);
    }
  } catch (error) {
    console.error("Error loading collections:", error);
  }
}

// Render preview with product data
function renderPreview(data) {
  document.getElementById('item-title').textContent = data.title || 'Untitled Item';
  
  // Format price
  const priceText = data.price_string && data.price_string !== '0.00' 
    ? data.price_string 
    : (data.price > 0 ? `$${data.price.toFixed(2)}` : 'Price not found');
  document.getElementById('item-price').textContent = priceText;
  
  // Store badge
  const storeName = data.retailer || 'Unknown';
  document.getElementById('item-store').textContent = storeName;
  
  // Image
  const img = document.getElementById('item-image');
  if (data.image_url) {
    img.src = data.image_url;
    img.onerror = function() {
      this.style.display = 'none';
    };
  } else {
    img.style.display = 'none';
  }
  
  // Price history (placeholder - you can enhance this with real data)
  const priceHistoryDiv = document.getElementById('price-history');
  const lowestPriceEl = document.getElementById('lowest-price');
  if (data.price && data.price > 0) {
    // For now, show current price as lowest (you can enhance with real history)
    lowestPriceEl.textContent = priceText;
    priceHistoryDiv.style.display = 'flex';
  } else {
    priceHistoryDiv.style.display = 'none';
  }
}

// Collection selector click handler
collectionSelector.addEventListener('click', () => {
  // Toggle dropdown (simple implementation - you can enhance with a proper dropdown)
  if (collectionDropdown.classList.contains('hidden')) {
    showCollectionDropdown();
  } else {
    collectionDropdown.classList.add('hidden');
  }
});

// Show collection dropdown
function showCollectionDropdown() {
  collectionDropdown.innerHTML = '';
  collectionDropdown.classList.remove('hidden');
  
  // Add "General Wishlist" option
  const generalOption = document.createElement('div');
  generalOption.className = 'collection-option';
  generalOption.style.cssText = 'padding: 8px 12px; cursor: pointer; background: white; border-bottom: 1px solid #e4e4e7;';
  generalOption.textContent = 'General Wishlist';
  generalOption.onclick = () => {
    selectedCollectionId = null;
    collectionName.textContent = 'General Wishlist';
    collectionDropdown.classList.add('hidden');
  };
  collectionDropdown.appendChild(generalOption);
  
  // Add collection options
  collections.forEach(collection => {
    const option = document.createElement('div');
    option.className = 'collection-option';
    option.style.cssText = 'padding: 8px 12px; cursor: pointer; background: white; border-bottom: 1px solid #e4e4e7;';
    option.textContent = collection.name;
    option.onclick = () => {
      selectedCollectionId = collection.id;
      collectionName.textContent = collection.name;
      collectionDropdown.classList.add('hidden');
    };
    collectionDropdown.appendChild(option);
  });
  
  // Close dropdown when clicking outside
  setTimeout(() => {
    document.addEventListener('click', function closeDropdown(e) {
      if (!collectionDropdown.contains(e.target) && !collectionSelector.contains(e.target)) {
        collectionDropdown.classList.add('hidden');
        document.removeEventListener('click', closeDropdown);
      }
    });
  }, 0);
}

// Privacy toggle handler
privacyToggle.addEventListener('click', () => {
  isPrivate = !isPrivate;
  updatePrivacyUI();
});

function updatePrivacyUI() {
  if (isPrivate) {
    privacyToggle.classList.remove('active');
    privacyText.textContent = 'Private Wishlist';
    privacyIcon.innerHTML = '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path>';
    privacyIcon.classList.remove('public');
  } else {
    privacyToggle.classList.add('active');
    privacyText.textContent = 'Public Feed';
    privacyIcon.innerHTML = '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>';
    privacyIcon.classList.add('public');
  }
}

// Save button handler
saveBtn.addEventListener('click', () => {
  if (!currentProduct) return;
  handleSave(currentProduct);
});

// Save handler
async function handleSave(item) {
  saveBtn.textContent = "Saving...";
  saveBtn.disabled = true;

  // Prepare payload with collection and privacy settings
  const payload = {
    ...item,
    collection_id: selectedCollectionId || null,
    is_public: !isPrivate
  };

  chrome.runtime.sendMessage(
    { action: "SAVE_ITEM", data: payload },
    (response) => {
      // Check for Chrome runtime errors
      if (chrome.runtime.lastError) {
        saveBtn.textContent = "Connection Error";
        saveBtn.style.backgroundColor = "#EF4444";
        console.error("Runtime Error:", chrome.runtime.lastError);
        setTimeout(() => {
          saveBtn.textContent = "Save Item";
          saveBtn.disabled = false;
          saveBtn.style.backgroundColor = "";
        }, 2000);
        return;
      }

      if (response && response.success) {
        showState('success');
        setTimeout(() => {
          window.close();
        }, 2000);
      } else {
        saveBtn.textContent = "Error - Try Login";
        saveBtn.style.backgroundColor = "#EF4444";
        console.error("Save Error:", response?.error);
        
        // Show error message if auth required
        if (response?.error && response.error.includes("logged in")) {
          errorMsg.textContent = "Please log in to Wist first.";
          showState('error');
          setTimeout(() => {
            chrome.tabs.create({ url: 'https://wishlist.nuvio.cloud/login' });
          }, 1000);
        }
        
        // Reset button
        setTimeout(() => {
          saveBtn.textContent = "Save Item";
          saveBtn.disabled = false;
          saveBtn.style.backgroundColor = ""; 
        }, 2000);
      }
    }
  );
}

// Product scraping function (injected into page)
function scrapeProductData() {
  // UNIVERSAL PRODUCT EXTRACTION - Works on Amazon, independent stores, and generic e-commerce sites
  
  // ============================================
  // 1. TITLE EXTRACTION (Multiple strategies)
  // ============================================
  let title = null;
  
  // Strategy 1: JSON-LD structured data (most reliable)
  try {
    const jsonLdScripts = document.querySelectorAll('script[type="application/ld+json"]');
    for (const script of jsonLdScripts) {
      try {
        const data = JSON.parse(script.textContent);
        const items = Array.isArray(data) ? data : [data];
        for (const item of items) {
          if (item['@type'] === 'Product' || (Array.isArray(item['@type']) && item['@type'].includes('Product'))) {
            title = item.name || item.title || null;
            if (title) break;
          }
        }
        if (title) break;
      } catch (e) {}
    }
  } catch (e) {}
  
  // Strategy 2: Open Graph meta tags (works on most sites)
  if (!title) {
    title = document.querySelector('meta[property="og:title"]')?.getAttribute('content')?.trim() || null;
  }
  
  // Strategy 3: Amazon-specific selectors
  if (!title) {
    title = document.getElementById('productTitle')?.innerText.trim() || null;
  }
  
  // Strategy 4: Generic h1 or title tag
  if (!title) {
    const h1 = document.querySelector('h1');
    if (h1) {
      title = h1.innerText.trim();
      title = title.replace(/^Amazon\.com:\s*/i, '').replace(/\s*:\s*Amazon\.com$/i, '');
    }
  }
  
  // Strategy 5: Page title as last resort
  if (!title) {
    title = document.title.trim();
    title = title.replace(/^Amazon\.com:\s*/i, '').replace(/\s*:\s*Amazon\.com$/i, '');
    title = title.replace(/\s*[-|]\s*.*$/, '');
  }
  
  // ============================================
  // 2. PRICE EXTRACTION (Multiple strategies)
  // ============================================
  let price = null;
  let priceString = null;
  
  // Strategy 1: JSON-LD structured data
  try {
    const jsonLdScripts = document.querySelectorAll('script[type="application/ld+json"]');
    for (const script of jsonLdScripts) {
      try {
        const data = JSON.parse(script.textContent);
        const items = Array.isArray(data) ? data : [data];
        for (const item of items) {
          if (item['@type'] === 'Product' || item['@type'] === 'Offer' || 
              (Array.isArray(item['@type']) && (item['@type'].includes('Product') || item['@type'].includes('Offer')))) {
            if (item.offers) {
              const offer = Array.isArray(item.offers) ? item.offers[0] : item.offers;
              if (offer.price) {
                price = parseFloat(offer.price);
                priceString = `$${price.toFixed(2)}`;
                break;
              } else if (offer.lowPrice) {
                price = parseFloat(offer.lowPrice);
                priceString = `$${price.toFixed(2)}`;
                break;
              }
            } else if (item.price) {
              price = parseFloat(item.price);
              priceString = `$${price.toFixed(2)}`;
              break;
            }
          }
        }
        if (price) break;
      } catch (e) {}
    }
  } catch (e) {}
  
  // Strategy 2: Meta tags
  if (!price) {
    const metaPrice = document.querySelector('meta[property="product:price:amount"]')?.getAttribute('content')
                   || document.querySelector('meta[property="og:price:amount"]')?.getAttribute('content')
                   || document.querySelector('meta[name="price"]')?.getAttribute('content');
    if (metaPrice) {
      price = parseFloat(metaPrice);
      priceString = `$${price.toFixed(2)}`;
    }
  }
  
  // Strategy 3: Amazon-specific selectors
  if (!price) {
    const amazonPriceSelectors = [
      '.a-price .a-offscreen',
      '#corePrice_feature_div .a-offscreen',
      '#corePriceDisplay_desktop_feature_div .a-offscreen',
      '#apex_desktop .a-offscreen',
      '.a-price-whole',
      '.a-price .a-price-whole',
      '#priceblock_ourprice',
      '#priceblock_dealprice',
      '#priceblock_saleprice',
      '#price',
      '.a-color-price',
      '.a-size-medium.a-color-price',
      '.a-price-range .a-offscreen',
      'input#twister-plus-price-data-price',
      '#priceblock_usedprice',
      '#priceblock_newprice',
      '.a-mobile .a-price .a-offscreen',
      '#mobile-price .a-offscreen',
      '.a-price.a-text-price .a-offscreen',
      '.a-price-range .a-offscreen:first-child'
    ];
    
    for (const selector of amazonPriceSelectors) {
      const element = document.querySelector(selector);
      if (element) {
        priceString = element.innerText?.trim() || element.textContent?.trim() || element.getAttribute('value');
        if (priceString && priceString !== '0.00' && priceString !== '$0.00') {
          break;
        }
      }
    }
    
    if (!priceString) {
      const priceData = document.querySelector('[data-asin-price]')?.getAttribute('data-asin-price')
                     || document.querySelector('[data-price]')?.getAttribute('data-price');
      if (priceData) priceString = priceData;
    }
  }
  
  // Strategy 4: Generic e-commerce selectors
  if (!price) {
    const genericPriceSelectors = [
      '.price',
      '.product-price',
      '.price-current',
      '.current-price',
      '.sale-price',
      '.regular-price',
      '[data-price]',
      '[itemprop="price"]',
      '.price-value',
      '.product-price-value',
      '#product-price',
      '.price-wrapper .price',
      '.product-info .price',
      '.product-details .price'
    ];
    
    for (const selector of genericPriceSelectors) {
      const element = document.querySelector(selector);
      if (element) {
        priceString = element.innerText?.trim() || element.textContent?.trim() || element.getAttribute('content');
        if (priceString && priceString.match(/\$?\d+\.?\d*/)) {
          break;
        }
      }
    }
  }
  
  // Strategy 5: Regex search in page text
  if (!priceString) {
    const bodyText = document.body?.innerText || '';
    const priceMatch = bodyText.match(/\$?\s*(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)/);
    if (priceMatch) {
      priceString = priceMatch[0].trim();
    }
  }
  
  // Clean and parse price
  if (priceString) {
    const cleanPrice = priceString.replace(/[^0-9.]/g, '');
    price = parseFloat(cleanPrice) || 0;
    
    if (price > 1000000) {
      const match = cleanPrice.match(/(\d+\.?\d*)/);
      if (match) price = parseFloat(match[1]) || 0;
    }
  } else {
    price = 0;
    priceString = "Price not found";
  }
  
  // ============================================
  // 3. IMAGE EXTRACTION (Multiple strategies)
  // ============================================
  let image = null;
  
  // Strategy 1: JSON-LD structured data
  try {
    const jsonLdScripts = document.querySelectorAll('script[type="application/ld+json"]');
    for (const script of jsonLdScripts) {
      try {
        const data = JSON.parse(script.textContent);
        const items = Array.isArray(data) ? data : [data];
        for (const item of items) {
          if (item['@type'] === 'Product') {
            if (item.image) {
              if (Array.isArray(item.image)) {
                image = item.image[0] || null;
              } else if (typeof item.image === 'string') {
                image = item.image;
              } else if (item.image.url) {
                image = item.image.url;
              }
              if (image) break;
            }
          }
        }
        if (image) break;
      } catch (e) {}
    }
  } catch (e) {}
  
  // Strategy 2: Open Graph meta tag
  if (!image) {
    image = document.querySelector('meta[property="og:image"]')?.getAttribute('content') || null;
  }
  
  // Strategy 3: Amazon-specific selectors
  if (!image) {
    image = document.getElementById('landingImage')?.src 
         || document.querySelector('#imgBlkFront')?.src
         || document.querySelector('.a-dynamic-image')?.src
         || null;
  }
  
  // Strategy 4: Generic product image selectors
  if (!image) {
    const genericImageSelectors = [
      '.product-image img',
      '.product-photo img',
      '.product-gallery img',
      '[itemprop="image"]',
      '.main-image img',
      '#product-image img',
      '.product-main-image img',
      'img[alt*="product"]',
      'img[alt*="Product"]'
    ];
    
    for (const selector of genericImageSelectors) {
      const img = document.querySelector(selector);
      if (img && img.src && !img.src.includes('placeholder') && !img.src.includes('loading')) {
        image = img.src;
        break;
      }
    }
  }
  
  // Strategy 5: First large image (fallback)
  if (!image) {
    const images = document.querySelectorAll('img');
    for (const img of images) {
      if (img.naturalWidth > 200 && img.naturalHeight > 200 && 
          !img.src.includes('logo') && !img.src.includes('icon') &&
          !img.src.includes('avatar') && !img.src.includes('placeholder')) {
        image = img.src;
        break;
      }
    }
  }

  // Extract retailer from URL
  const urlObj = new URL(window.location.href);
  const retailer = urlObj.hostname.replace('www.', '').split('.')[0];

  return { 
    title: title || 'Untitled Item',
    price: price || 0,
    price_string: priceString || (price > 0 ? `$${price.toFixed(2)}` : "Price not found"),
    image_url: image || '',
    url: window.location.href,
    retailer: retailer.charAt(0).toUpperCase() + retailer.slice(1)
  };
}
