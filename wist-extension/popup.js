// popup.js - Simplified Wist Extension Popup (No Collection Selector)
const API_BASE_URL = "https://wishlist.nuvio.cloud";

// UI Elements
const loadingDiv = document.getElementById('loading');
const previewDiv = document.getElementById('preview');
const successDiv = document.getElementById('success');
const errorDiv = document.getElementById('error');
const errorMsg = document.getElementById('error-msg');
const saveBtn = document.getElementById('save-btn');
const privacyBtn = document.getElementById('privacy-btn');
const privacySwitch = document.getElementById('privacy-switch');
const privacyText = document.getElementById('privacy-text');

// State
let currentProduct = null;
let isPrivate = true; // Default to Private

// Helper to show states
function showState(state) {
  loadingDiv.classList.add('hidden');
  previewDiv.classList.add('hidden');
  successDiv.style.display = 'none';
  errorDiv.classList.add('hidden');
  
  if (state === 'loading') loadingDiv.classList.remove('hidden');
  if (state === 'preview') previewDiv.classList.remove('hidden');
  if (state === 'success') successDiv.style.display = 'flex';
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

    // 2. Scrape product data from the page
    try {
      const results = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: scrapeProductData
      });

      const data = results[0].result;
      currentProduct = data;
      
      // 3. Render Preview
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

// Render preview with product data
function renderPreview(data) {
  document.getElementById('product-title').textContent = data.title || 'Untitled Item';
  
  // Format price
  const priceText = data.price_string && data.price_string !== '0.00' 
    ? data.price_string 
    : (data.price > 0 ? `$${data.price.toFixed(2)}` : 'Price not found');
  document.getElementById('product-price').textContent = priceText;
  
  // Store badge
  const storeName = data.retailer || 'Unknown';
  document.getElementById('retailer-badge').textContent = storeName;
  
  // Image
  const img = document.getElementById('product-img');
  if (data.image_url) {
    img.src = data.image_url;
    img.onerror = function() {
      this.style.display = 'none';
    };
  } else {
    img.style.display = 'none';
  }
}

// Privacy toggle handler
privacyBtn.addEventListener('click', () => {
  isPrivate = !isPrivate;
  updatePrivacyUI();
});

function updatePrivacyUI() {
  if (isPrivate) {
    privacySwitch.classList.remove('active');
    privacyText.textContent = 'Private Wishlist';
    // Update lock icon
    document.getElementById('lock-icon').innerHTML = '<rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path>';
  } else {
    privacySwitch.classList.add('active');
    privacyText.textContent = 'Public Feed';
    // Update to globe icon
    document.getElementById('lock-icon').innerHTML = '<circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path>';
  }
}

// Save button handler
saveBtn.addEventListener('click', () => {
  if (!currentProduct) return;
  handleSave(currentProduct);
});

// Save handler - Uses background.js for authentication
async function handleSave(item) {
  saveBtn.textContent = "Saving...";
  saveBtn.disabled = true;

  // Prepare payload with privacy settings (no collection_id - backend handles it)
  const payload = {
    ...item,
    is_public: !isPrivate,
    collection_id: null // Explicitly null - backend will handle categorization later
  };

  // Send to background.js which handles authentication
  chrome.runtime.sendMessage(
    { action: "SAVE_ITEM", data: payload },
    (response) => {
      // Check for Chrome runtime errors
      if (chrome.runtime.lastError) {
        saveBtn.textContent = "Connection Error";
        saveBtn.style.backgroundColor = "#EF4444";
        console.error("Runtime Error:", chrome.runtime.lastError);
        setTimeout(() => {
          saveBtn.textContent = "Save to Wist";
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
        if (response?.error && (response.error.includes("logged in") || response.error.includes("Unauthorized") || response.error.includes("Token"))) {
          errorMsg.textContent = "Please log in to Wist first.";
          showState('error');
          setTimeout(() => {
            chrome.tabs.create({ url: 'https://wishlist.nuvio.cloud/login' });
          }, 1000);
        } else {
          errorMsg.textContent = response?.error || "Failed to save item.";
          showState('error');
        }
        
        // Reset button
        setTimeout(() => {
          saveBtn.textContent = "Save to Wist";
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
