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

// Lordicon Animation Function
// Loads the animation JSON from lordicon-animation.json file
async function playLordiconAnimation() {
  const animationContainer = document.getElementById('lordicon-animation');
  if (!animationContainer) {
    console.warn('Animation container not found');
    return;
  }

  try {
    // Load the JSON animation file
    const response = await fetch(chrome.runtime.getURL('lordicon-animation.json'));
    if (!response.ok) {
      throw new Error(`Failed to load animation: ${response.status}`);
    }
    const animationJson = await response.json();

    // Wait for Lordicon library to be available
    let retries = 0;
    const maxRetries = 10;
    while (typeof lordicon === 'undefined' && retries < maxRetries) {
      await new Promise(resolve => setTimeout(resolve, 100));
      retries++;
    }

    if (typeof lordicon === 'undefined') {
      console.error('Lordicon library not loaded after waiting');
      return;
    }

    // Initialize Lordicon with the JSON
    lordicon.load({
      element: animationContainer,
      src: animationJson,
      colors: {
        primary: '#7c3aed', // Violet color to match your brand
        secondary: '#a855f7'
      },
      size: 80
    });
  } catch (error) {
    console.error('Error loading Lordicon animation:', error);
    // Fallback: show a simple checkmark if animation fails
    animationContainer.innerHTML = '<div style="width: 80px; height: 80px; background: #dcfce7; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 32px; color: #16a34a;">✓</div>';
  }
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
        // Initialize and play Lordicon animation
        playLordiconAnimation();
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
  
  // Clean and parse price (robust parsing similar to server-side)
  if (priceString) {
    // Handle price ranges (e.g., "$19.99 - $29.99" -> take first price)
    if (priceString.includes('-') || priceString.includes('–')) {
      const parts = priceString.split(/[-–]/);
      priceString = parts[0].trim();
    }
    
    // Remove currency symbols and whitespace, keep digits, dots, and commas
    const normalized = priceString.replace(/[^\d.,]/g, '').trim();
    
    if (normalized) {
      // Handle formats like "1,234.56" (US) or "1.234,56" (European)
      if (normalized.indexOf(',') > -1 && normalized.indexOf('.') > -1) {
        // Determine which is decimal separator based on last separator position
        if (normalized.lastIndexOf(',') > normalized.lastIndexOf('.')) {
          // European format: "1.234,56" -> "1234.56"
          price = parseFloat(normalized.replace(/\./g, '').replace(',', '.')) || 0;
        } else {
          // US format: "1,234.56" -> "1234.56"
          price = parseFloat(normalized.replace(/,/g, '')) || 0;
        }
      } else if (normalized.indexOf(',') > -1) {
        // Only commas: could be thousands separator or decimal separator
        // If comma is followed by 2 digits, treat as decimal (e.g., "19,99")
        const commaIndex = normalized.indexOf(',');
        const afterComma = normalized.substring(commaIndex + 1);
        if (afterComma.length === 2 && /^\d{2}$/.test(afterComma)) {
          // Decimal separator: "19,99" -> "19.99"
          price = parseFloat(normalized.replace(',', '.')) || 0;
        } else {
          // Thousands separator: "1,234" -> "1234"
          price = parseFloat(normalized.replace(/,/g, '')) || 0;
        }
      } else {
        // Only dots or no separators
        price = parseFloat(normalized) || 0;
      }
      
      // Sanity check: if price seems too large, try to extract a more reasonable value
      if (price > 1000000) {
        // Try to find a reasonable price pattern (e.g., extract first reasonable number)
        const match = normalized.match(/(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)/);
        if (match) {
          const reasonablePrice = match[1].replace(/,/g, '');
          price = parseFloat(reasonablePrice) || 0;
        }
      }
    } else {
      price = 0;
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
  
  // Strategy 3.5: Etsy-specific selectors (IMPROVED)
  if (!image) {
    // Check if we're on Etsy
    const isEtsy = window.location.hostname.includes('etsy.com');
    if (isEtsy) {
      // Helper function to get image URL from element (handles lazy loading and background images)
      const getImageUrl = (img) => {
        if (!img) return null;
        // Check src first
        let url = img.src || img.getAttribute('src');
        // Check data-src for lazy-loaded images
        if (!url || url.includes('placeholder') || url.includes('loading')) {
          url = img.getAttribute('data-src') || img.getAttribute('data-lazy-src');
        }
        // Check data-image-url
        if (!url || url.includes('placeholder') || url.includes('loading')) {
          url = img.getAttribute('data-image-url');
        }
        // Check for background-image CSS (Etsy sometimes uses divs with background images)
        if (!url && img.style && img.style.backgroundImage) {
          const bgMatch = img.style.backgroundImage.match(/url\(['"]?([^'"]+)['"]?\)/);
          if (bgMatch && bgMatch[1]) {
            url = bgMatch[1];
          }
        }
        // Check parent element for background-image
        if (!url && img.parentElement) {
          const computedStyle = window.getComputedStyle(img.parentElement);
          if (computedStyle.backgroundImage && computedStyle.backgroundImage !== 'none') {
            const bgMatch = computedStyle.backgroundImage.match(/url\(['"]?([^'"]+)['"]?\)/);
            if (bgMatch && bgMatch[1] && bgMatch[1].includes('etsystatic.com')) {
              url = bgMatch[1];
            }
          }
        }
        return url;
      };
      
      // Try Etsy-specific selectors (expanded list)
      const etsySelectors = [
        // Main product image containers
        '.listing-page-image img',
        '.listing-page-image-carousel img',
        '.listing-page-image-container img',
        '[data-carousel-first-image] img',
        '.image-carousel img',
        '.listing-image img',
        '#listing-page-cart img',
        // Etsy-specific classes
        '.wt-max-width-full img[src*="etsystatic.com"]',
        '.wt-display-block img[src*="etsystatic.com"]',
        '.wt-width-full img[src*="etsystatic.com"]',
        // Direct image selectors
        'img[src*="etsystatic.com"][src*="/il/"]', // Etsy image URLs contain /il/ pattern
        'img[data-src*="etsystatic.com"]', // Lazy-loaded images
        'img[data-image-url*="etsystatic.com"]',
        // Picture element sources
        'picture source[srcset*="etsystatic.com"]',
        'picture img[src*="etsystatic.com"]',
        // Carousel images
        '.carousel img[src*="etsystatic.com"]',
        '[data-carousel] img[src*="etsystatic.com"]',
        // Gallery images
        '.gallery img[src*="etsystatic.com"]',
        '.image-gallery img[src*="etsystatic.com"]'
      ];
      
      for (const selector of etsySelectors) {
        const img = document.querySelector(selector);
        if (!img) continue;
        
        // Handle picture/source elements
        let imgUrl = null;
        if (img.tagName === 'SOURCE') {
          imgUrl = img.getAttribute('srcset') || img.getAttribute('src');
          if (imgUrl && imgUrl.includes(',')) {
            // srcset can have multiple URLs, take the first one
            imgUrl = imgUrl.split(',')[0].trim().split(' ')[0];
          }
        } else {
          imgUrl = getImageUrl(img);
        }
        
        if (imgUrl && imgUrl.includes('etsystatic.com') && 
            !imgUrl.includes('placeholder') && 
            !imgUrl.includes('loading') &&
            !imgUrl.includes('avatar') &&
            !imgUrl.includes('logo') &&
            !imgUrl.includes('icon')) {
          // Get the full resolution image URL (remove size parameters)
          image = imgUrl.replace(/\/\d+x\d+\//, '/').replace(/\/\d+x\d+\./, '.').split('?')[0];
          break;
        }
      }
      
      // If still no image, try finding the first Etsy image in common containers
      if (!image) {
        const etsyContainers = [
          '.listing-page-image',
          '.image-carousel-container',
          '.listing-image-container',
          '[data-carousel-first-image]',
          '[data-carousel-container]',
          '.carousel-container',
          '.gallery-container',
          '[data-listing-image]'
        ];
        
        for (const containerSelector of etsyContainers) {
          const container = document.querySelector(containerSelector);
          if (container) {
            // Try direct img first
            let img = container.querySelector('img[src*="etsystatic.com"]');
            if (!img) {
              img = container.querySelector('img[data-src*="etsystatic.com"]');
            }
            if (!img) {
              img = container.querySelector('img[data-image-url*="etsystatic.com"]');
            }
            if (!img) {
              img = container.querySelector('picture img[src*="etsystatic.com"]');
            }
            // Check for background-image on container
            if (!img) {
              const computedStyle = window.getComputedStyle(container);
              if (computedStyle.backgroundImage && computedStyle.backgroundImage !== 'none') {
                const bgMatch = computedStyle.backgroundImage.match(/url\(['"]?([^'"]+)['"]?\)/);
                if (bgMatch && bgMatch[1] && bgMatch[1].includes('etsystatic.com')) {
                  image = bgMatch[1].replace(/\/\d+x\d+\//, '/').replace(/\/\d+x\d+\./, '.').split('?')[0];
                  break;
                }
              }
            }
            
            if (img) {
              const imgUrl = getImageUrl(img);
              if (imgUrl && !imgUrl.includes('placeholder') && !imgUrl.includes('avatar') && !imgUrl.includes('logo')) {
                image = imgUrl.replace(/\/\d+x\d+\//, '/').replace(/\/\d+x\d+\./, '.').split('?')[0];
                break;
              }
            }
          }
        }
      }
      
      // Last resort: find any Etsy image on the page (improved)
      if (!image) {
        const allImages = document.querySelectorAll('img[src*="etsystatic.com"], img[data-src*="etsystatic.com"], img[data-image-url*="etsystatic.com"], picture source[srcset*="etsystatic.com"]');
        const candidates = [];
        
        for (const img of allImages) {
          let imgUrl = null;
          if (img.tagName === 'SOURCE') {
            const srcset = img.getAttribute('srcset');
            if (srcset) {
              imgUrl = srcset.split(',')[0].trim().split(' ')[0];
            }
          } else {
            imgUrl = getImageUrl(img);
          }
          
          if (imgUrl && imgUrl.includes('/il/') && // Etsy product images have /il/ in path
              !imgUrl.includes('placeholder') && 
              !imgUrl.includes('loading') &&
              !imgUrl.includes('avatar') &&
              !imgUrl.includes('logo') &&
              !imgUrl.includes('icon')) {
            // Prefer larger images
            const width = img.naturalWidth || img.width || 0;
            candidates.push({ url: imgUrl, width });
          }
        }
        
        // Sort by width and pick the largest
        if (candidates.length > 0) {
          candidates.sort((a, b) => b.width - a.width);
          image = candidates[0].url.replace(/\/\d+x\d+\//, '/').replace(/\/\d+x\d+\./, '.').split('?')[0];
        }
      }
    }
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

  // --- ETSY PATCH START ---
  // Etsy lazy-loads images, which often breaks standard scrapers.
  // We force it to grab the "Social Share" image which is always high-res and available.
  if (window.location.hostname.includes('etsy.com')) {
    const etsyMeta = document.querySelector('meta[property="og:image"]');
    if (etsyMeta && etsyMeta.content) {
      // Always override with og:image for Etsy - it's the most reliable source
      image = etsyMeta.content.trim();
      console.log('[Etsy Patch] Using og:image:', image);
    } else {
      // Fallback: try to find any etsystatic.com image in meta tags or structured data
      const jsonLdScripts = document.querySelectorAll('script[type="application/ld+json"]');
      for (const script of jsonLdScripts) {
        try {
          const data = JSON.parse(script.textContent);
          const items = Array.isArray(data) ? data : [data];
          for (const item of items) {
            if (item['@type'] === 'Product' && item.image) {
              let imgUrl = Array.isArray(item.image) ? item.image[0] : item.image;
              if (typeof imgUrl === 'object' && imgUrl.url) {
                imgUrl = imgUrl.url;
              }
              if (imgUrl && typeof imgUrl === 'string' && imgUrl.includes('etsystatic.com')) {
                image = imgUrl;
                console.log('[Etsy Patch] Using JSON-LD image:', image);
                break;
              }
            }
          }
          if (image) break;
        } catch (e) {}
      }
    }
  }
  // --- ETSY PATCH END ---

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
