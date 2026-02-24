// content.js

// 0. Announce extension presence immediately (before anything else)
// This allows the React app to detect if the extension is installed
document.documentElement.setAttribute('data-wist-installed', 'true');

// ============================================================================
// SCRAPE REQUEST HANDLER - For webapp "paste link" feature
// ============================================================================

// Listen for messages from the webapp (auth tokens + scrape requests)
window.addEventListener('message', async (event) => {
  if (event.source !== window) return;

  // Relay auth token from the website to the background script
  // This works regardless of extension ID — no hardcoded ID needed
  if (event.data?.type === 'WIST_AUTH_TOKEN' || event.data?.type === 'AUTH_TOKEN') {
    const token = event.data.token;
    const session = event.data.session;
    if (!token) return;

    console.log('🔑 [ContentScript] Relaying auth token to background...');
    chrome.runtime.sendMessage({
      type: 'AUTH_TOKEN',
      token: token,
      session: session,
      timestamp: Date.now()
    }, (response) => {
      if (chrome.runtime.lastError) {
        console.warn('⚠️ [ContentScript] Token relay failed:', chrome.runtime.lastError.message);
      } else {
        console.log('✅ [ContentScript] Token relayed to background');
      }
    });
    return;
  }

  if (event.data?.type === 'WIST_SCRAPE_REQUEST') {
    const { messageId, url } = event.data;
    console.log('🧩 [ContentScript] Received scrape request for:', url);
    
    try {
      // Send request to background script to handle the scraping
      chrome.runtime.sendMessage({
        action: 'SCRAPE_URL_FOR_WEBAPP',
        url: url,
        messageId: messageId
      }, (response) => {
        if (chrome.runtime.lastError) {
          console.error('❌ [ContentScript] Background script error:', chrome.runtime.lastError);
          window.postMessage({
            type: 'WIST_SCRAPE_RESULT',
            messageId: messageId,
            success: false,
            error: chrome.runtime.lastError.message || 'Extension communication failed'
          }, '*');
          return;
        }
        
        console.log('✅ [ContentScript] Received scrape response:', response);
        window.postMessage({
          type: 'WIST_SCRAPE_RESULT',
          messageId: messageId,
          success: response?.success || false,
          data: response?.data || null,
          error: response?.error || null
        }, '*');
      });
    } catch (error) {
      console.error('❌ [ContentScript] Error handling scrape request:', error);
      window.postMessage({
        type: 'WIST_SCRAPE_RESULT',
        messageId: messageId,
        success: false,
        error: error.message || 'Unknown error'
      }, '*');
    }
  }
});

// ============================================================================
// PRODUCT SCRAPER - Universal scraping functions
// ============================================================================

// Scrape product data from the current page
function scrapeCurrentPage() {
  const url = window.location.href;
  const domain = window.location.hostname.toLowerCase();
  
  console.log('🔍 [ContentScript] Scraping page:', url);
  
  let title = null;
  let price = null;
  let image = null;
  let description = null;
  
  // Domain-specific scraping
  if (domain.includes('amazon.')) {
    const result = scrapeAmazon();
    title = result.title;
    price = result.price;
    image = result.image;
    description = result.description;
  } else if (domain.includes('etsy.')) {
    const result = scrapeEtsy();
    title = result.title;
    price = result.price;
    image = result.image;
    description = result.description;
  } else if (domain.includes('target.')) {
    const result = scrapeTarget();
    title = result.title;
    price = result.price;
    image = result.image;
    description = result.description;
  } else if (domain.includes('walmart.')) {
    const result = scrapeWalmart();
    title = result.title;
    price = result.price;
    image = result.image;
    description = result.description;
  } else if (domain.includes('bestbuy.')) {
    const result = scrapeBestBuy();
    title = result.title;
    price = result.price;
    image = result.image;
    description = result.description;
  } else if (domain.includes('taobao.') || domain.includes('tmall.') || domain.includes('1688.')) {
    const result = scrapeTaobao();
    title = result.title;
    price = result.price;
    image = result.image;
    description = result.description;
  } else if (domain.includes('kakobuy.') || domain.includes('superbuy.') || domain.includes('wegobuy.') || domain.includes('pandabuy.') || domain.includes('cssbuy.')) {
    const result = scrapeAgentSite();
    title = result.title;
    price = result.price;
    image = result.image;
    description = result.description;
  } else {
    // Generic scraping for other sites
    const result = scrapeGeneric();
    title = result.title;
    price = result.price;
    image = result.image;
    description = result.description;
  }
  
  // Detect currency from the raw price string
  const currencyInfo = detectCurrency(price, domain);
  
  // Clean up price (extract numeric value)
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
    currency: currencyInfo.code,
    original_price_raw: price || null,
  };
}

// Amazon scraper
function scrapeAmazon() {
  console.log('🛒 [ContentScript] Scraping Amazon...');
  
  // Title
  let title = null;
  const titleSelectors = ['#productTitle', '#title', 'h1.a-size-large', 'span#productTitle'];
  for (const sel of titleSelectors) {
    const el = document.querySelector(sel);
    if (el && el.textContent?.trim()) {
      title = el.textContent.trim();
      break;
    }
  }
  
  // Price - priority order for accuracy
  let price = null;
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
    '#kindle-price',
    '#price',
    '.a-price:not(.a-text-price) .a-offscreen',
    '.header-price',
    '#newBuyBoxPrice',
    '.offer-price'
  ];
  for (const sel of priceSelectors) {
    const el = document.querySelector(sel);
    if (el) {
      const text = el.textContent?.trim() || el.innerText?.trim();
      if (text && /\d/.test(text)) {
        price = text;
        console.log('[Wist] Found Amazon price via:', sel, '=', text);
        break;
      }
    }
  }
  
  // Image
  let image = null;
  const imageSelectors = ['#landingImage', '#imgBlkFront', '#main-image', 'img[data-a-image-name="landingImage"]'];
  for (const sel of imageSelectors) {
    const el = document.querySelector(sel);
    if (el && el.src) {
      image = el.src;
      break;
    }
  }
  
  // Also try data-old-hires for high-res image
  if (!image) {
    const hiresEl = document.querySelector('[data-old-hires]');
    if (hiresEl) {
      image = hiresEl.getAttribute('data-old-hires') || hiresEl.src;
    }
  }
  
  // Description
  let description = null;
  const descEl = document.querySelector('#productDescription p, #feature-bullets ul');
  if (descEl) {
    description = descEl.textContent?.trim().substring(0, 500);
  }
  
  return { title, price, image, description };
}

// Etsy scraper
function scrapeEtsy() {
  console.log('🎨 [ContentScript] Scraping Etsy...');
  
  let title = null;
  const titleEl = document.querySelector('h1[data-buy-box-listing-title], h1');
  if (titleEl) title = titleEl.textContent?.trim();
  
  let price = null;
  const priceEl = document.querySelector('[data-buy-box-region="price"] p, .wt-text-title-larger, [data-selector="price-only"]');
  if (priceEl) price = priceEl.textContent?.trim();
  
  let image = null;
  const imageEl = document.querySelector('[data-carousel-paging] img, .listing-page-image-carousel img, img[data-listing-id]');
  if (imageEl) image = imageEl.src;
  
  let description = null;
  const descEl = document.querySelector('[data-id="description-text"], #description-text');
  if (descEl) description = descEl.textContent?.trim().substring(0, 500);
  
  return { title, price, image, description };
}

// Target scraper
function scrapeTarget() {
  console.log('🎯 [ContentScript] Scraping Target...');
  
  let title = null;
  const titleEl = document.querySelector('h1[data-test="product-title"], h1');
  if (titleEl) title = titleEl.textContent?.trim();
  
  let price = null;
  const priceEl = document.querySelector('[data-test="product-price"], span[data-test="product-price"]');
  if (priceEl) price = priceEl.textContent?.trim();
  
  let image = null;
  const imageEl = document.querySelector('[data-test="product-image"] img, img[alt*="product"]');
  if (imageEl) image = imageEl.src;
  
  let description = null;
  const descEl = document.querySelector('[data-test="product-description"]');
  if (descEl) description = descEl.textContent?.trim().substring(0, 500);
  
  return { title, price, image, description };
}

// Walmart scraper
function scrapeWalmart() {
  console.log('🏪 [ContentScript] Scraping Walmart...');
  
  let title = null;
  const titleEl = document.querySelector('h1[itemprop="name"], h1');
  if (titleEl) title = titleEl.textContent?.trim();
  
  let price = null;
  const priceEl = document.querySelector('[itemprop="price"], span[data-testid="price"]');
  if (priceEl) price = priceEl.textContent?.trim() || priceEl.getAttribute('content');
  
  let image = null;
  const imageEl = document.querySelector('[data-testid="hero-image"] img, img[data-testid="product-image"]');
  if (imageEl) image = imageEl.src;
  
  let description = null;
  const descEl = document.querySelector('[data-testid="product-description"]');
  if (descEl) description = descEl.textContent?.trim().substring(0, 500);
  
  return { title, price, image, description };
}

// Best Buy scraper
function scrapeBestBuy() {
  console.log('💻 [ContentScript] Scraping Best Buy...');
  
  let title = null;
  const titleEl = document.querySelector('h1.heading-5, h1[class*="sku-title"]');
  if (titleEl) title = titleEl.textContent?.trim();
  
  let price = null;
  const priceEl = document.querySelector('.priceView-customer-price span, [data-testid="customer-price"]');
  if (priceEl) price = priceEl.textContent?.trim();
  
  let image = null;
  const imageEl = document.querySelector('img.primary-image, [data-testid="product-image"] img');
  if (imageEl) image = imageEl.src;
  
  let description = null;
  const descEl = document.querySelector('[data-testid="product-description"]');
  if (descEl) description = descEl.textContent?.trim().substring(0, 500);
  
  return { title, price, image, description };
}

// Taobao / Tmall / 1688 scraper
function scrapeTaobao() {
  console.log('🇨🇳 [ContentScript] Scraping Taobao/Tmall...');
  
  let title = null;
  const titleSelectors = [
    'h3.tb-main-title', '.tb-detail-hd h1', '.ItemHeader--mainTitle',
    'h1[data-title]', '.tb-main-title', '.d-title',
    '[class*="ItemHeader"] h1', '[class*="title--"] h3',
    'meta[property="og:title"]'
  ];
  for (const sel of titleSelectors) {
    const el = document.querySelector(sel);
    if (el) {
      title = el.getAttribute('content') || el.getAttribute('data-title') || el.textContent?.trim();
      if (title) break;
    }
  }
  
  let price = null;
  const priceSelectors = [
    '.tb-rmb-num', '.tm-price', '.tm-promo-price .tm-price',
    '[class*="Price--current"]', '[class*="price--current"]',
    '.tb-rmb', '#J_PromoPriceNum', '#J_StrPriceModBox .tb-rmb-num',
    '.originPrice', '[class*="extraPrice"] span'
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
  
  // Fallback: search page source for price JSON
  if (!price) {
    try {
      const html = document.documentElement.innerHTML;
      const patterns = [
        /"price"\s*:\s*"?([\d.]+)"?/,
        /"priceText"\s*:\s*"[¥￥]?([\d.]+)"/,
        /"promotionPrice"\s*:\s*"?([\d.]+)"?/,
      ];
      for (const p of patterns) {
        const m = html.match(p);
        if (m && m[1]) {
          const v = parseFloat(m[1]);
          if (v > 0 && v < 1000000) {
            price = '¥' + m[1];
            break;
          }
        }
      }
    } catch (e) {}
  }
  
  let image = null;
  const imageSelectors = [
    '#J_ImgBooth', '.tb-booth img', '[class*="PicGallery"] img',
    'img[data-src*="alicdn"]', '.thumbnails img', '#J_UlThumb img'
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
    const ogImg = document.querySelector('meta[property="og:image"]');
    if (ogImg) image = ogImg.getAttribute('content');
  }
  
  let description = null;
  const ogDesc = document.querySelector('meta[property="og:description"], meta[name="description"]');
  if (ogDesc) description = ogDesc.getAttribute('content')?.substring(0, 500);
  
  return { title, price, image, description };
}

// Agent/proxy sites (Kakobuy, Superbuy, Wegobuy, Pandabuy, CSSBuy)
function scrapeAgentSite() {
  const domain = window.location.hostname.toLowerCase();
  console.log('🛍️ [ContentScript] Scraping agent site:', domain);
  
  let title = null;
  let price = null;
  let image = null;
  let description = null;
  
  // These sites typically show product info in a structured way
  const titleSelectors = [
    'h1', '.product-title', '.goods-title', '[class*="goodsTitle"]',
    '[class*="product-name"]', '[class*="item-name"]', '.title',
    'meta[property="og:title"]'
  ];
  for (const sel of titleSelectors) {
    const el = document.querySelector(sel);
    if (el) {
      const text = el.getAttribute('content') || el.textContent?.trim();
      if (text && text.length > 5) { title = text; break; }
    }
  }
  
  // Price: these sites often show CNY
  const priceSelectors = [
    '[class*="price"]', '[class*="Price"]', '.goods-price',
    '.product-price', '.item-price', '.sale-price',
    'span[class*="price"]', 'div[class*="price"]'
  ];
  for (const sel of priceSelectors) {
    const els = document.querySelectorAll(sel);
    for (const el of els) {
      const text = el.textContent?.trim();
      if (text && /[\d.]+/.test(text) && text.length < 30) {
        price = text;
        break;
      }
    }
    if (price) break;
  }
  
  // Image
  const imageSelectors = [
    '.product-image img', '.goods-image img', '[class*="mainImage"] img',
    '[class*="gallery"] img', '.swiper-slide img', 'img[class*="product"]',
    'meta[property="og:image"]'
  ];
  for (const sel of imageSelectors) {
    const el = document.querySelector(sel);
    if (el) {
      const src = el.getAttribute('content') || el.getAttribute('data-src') || el.src;
      if (src && !src.includes('placeholder') && !src.includes('svg')) {
        image = src.startsWith('//') ? 'https:' + src : src;
        break;
      }
    }
  }
  
  const ogDesc = document.querySelector('meta[property="og:description"], meta[name="description"]');
  if (ogDesc) description = ogDesc.getAttribute('content')?.substring(0, 500);
  
  return { title, price, image, description };
}

// Currency detection from raw price strings and domain
function detectCurrency(rawPrice, domain) {
  if (!rawPrice && !domain) return { code: 'USD', symbol: '$' };
  
  const priceStr = (rawPrice || '').toString();
  
  // Symbol-based detection
  if (/¥|￥/.test(priceStr)) {
    // Distinguish JPY vs CNY based on domain
    if (domain && (domain.includes('.jp') || domain.includes('amazon.co.jp') || domain.includes('rakuten'))) {
      return { code: 'JPY', symbol: '¥' };
    }
    return { code: 'CNY', symbol: '¥' };
  }
  if (/€/.test(priceStr)) return { code: 'EUR', symbol: '€' };
  if (/£/.test(priceStr)) return { code: 'GBP', symbol: '£' };
  if (/₩/.test(priceStr)) return { code: 'KRW', symbol: '₩' };
  if (/₹/.test(priceStr)) return { code: 'INR', symbol: '₹' };
  if (/R\$/.test(priceStr)) return { code: 'BRL', symbol: 'R$' };
  if (/CA\$|CAD/.test(priceStr)) return { code: 'CAD', symbol: 'CA$' };
  if (/A\$|AU\$|AUD/.test(priceStr)) return { code: 'AUD', symbol: 'A$' };
  if (/\$/.test(priceStr)) {
    // Dollar sign — figure out which dollar based on domain
    if (domain) {
      if (domain.includes('.ca') || domain.includes('amazon.ca')) return { code: 'CAD', symbol: 'CA$' };
      if (domain.includes('.au') || domain.includes('amazon.com.au')) return { code: 'AUD', symbol: 'A$' };
    }
    return { code: 'USD', symbol: '$' };
  }
  
  // Domain-based fallback
  if (domain) {
    if (domain.includes('taobao.') || domain.includes('tmall.') || domain.includes('1688.') || 
        domain.includes('kakobuy.') || domain.includes('superbuy.') || domain.includes('wegobuy.') ||
        domain.includes('pandabuy.') || domain.includes('cssbuy.')) {
      return { code: 'CNY', symbol: '¥' };
    }
    if (domain.includes('.jp') || domain.includes('rakuten')) return { code: 'JPY', symbol: '¥' };
    if (domain.includes('.co.uk') || domain.includes('amazon.co.uk')) return { code: 'GBP', symbol: '£' };
    if (domain.includes('.de') || domain.includes('.fr') || domain.includes('.it') || domain.includes('.es')) return { code: 'EUR', symbol: '€' };
    if (domain.includes('.kr')) return { code: 'KRW', symbol: '₩' };
    if (domain.includes('.in') || domain.includes('amazon.in')) return { code: 'INR', symbol: '₹' };
  }
  
  return { code: 'USD', symbol: '$' };
}

// Generic scraper for other sites
function scrapeGeneric() {
  console.log('🌐 [ContentScript] Scraping generic site...');
  
  // Title from meta tags or h1
  let title = null;
  const ogTitle = document.querySelector('meta[property="og:title"]');
  const metaTitle = document.querySelector('meta[name="title"]');
  const h1 = document.querySelector('h1');
  title = ogTitle?.getAttribute('content') || metaTitle?.getAttribute('content') || h1?.textContent?.trim() || document.title;
  
  // Price from JSON-LD or meta tags
  let price = null;
  
  // Try JSON-LD first
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
  
  // Try meta tags
  if (!price) {
    const priceMeta = document.querySelector('meta[property="product:price:amount"], meta[property="og:price:amount"]');
    if (priceMeta) price = priceMeta.getAttribute('content');
  }
  
  // Image from meta tags
  let image = null;
  const ogImage = document.querySelector('meta[property="og:image"]');
  const metaImage = document.querySelector('meta[name="image"]');
  image = ogImage?.getAttribute('content') || metaImage?.getAttribute('content');
  
  // Description from meta tags
  let description = null;
  const ogDesc = document.querySelector('meta[property="og:description"]');
  const metaDesc = document.querySelector('meta[name="description"]');
  description = ogDesc?.getAttribute('content') || metaDesc?.getAttribute('content');
  
  return { title, price, image, description };
}

// Export scraper for background script to use
window.wistScrapeCurrentPage = scrapeCurrentPage;

// ============================================================================
// ORIGINAL CONTENT SCRIPT LOGIC
// ============================================================================

// 1. Listen for the page to load
window.addEventListener('load', () => {
  // A. Check if this is a real "Thank You" page (Production Mode)
  if (isOrderConfirmationPage()) {
    const purchaseData = scrapeOrderData();
    showCelebrationModal(purchaseData);
  }
});

// 2. Listen for our "Test Mode" Shortcut (Shift + Alt + P)
document.addEventListener('keydown', (e) => {
  if (e.shiftKey && e.altKey && (e.key === 'p' || e.key === 'P')) {
    console.log("🛠️ Simulating Purchase Event...");

    // --- IMPROVED PRICE FINDER (prioritizes "price to pay") ---
    function findPrice() {
      // Priority order: actual price to pay > deal prices > generic prices
      const selectors = [
        // Price to pay (most accurate)
        '.priceToPay .a-offscreen',
        '.priceToPay span.a-offscreen',
        '#corePrice_desktop .priceToPay .a-offscreen',
        '.apexPriceToPay .a-offscreen',
        // Deal/sale prices
        '#priceblock_dealprice',
        '#priceblock_saleprice',
        '#priceblock_ourprice',
        '#price_inside_buybox',
        // Standard price blocks
        '#corePrice_feature_div .a-price:not(.a-text-price) .a-offscreen',
        '#corePriceDisplay_desktop_feature_div .a-price:not(.a-text-price) .a-offscreen',
        // Kindle/Digital
        '#kindle-price',
        '#price',
        // Generic fallback
        '.a-price:not(.a-text-price) .a-offscreen',
        '.header-price',
        '#newBuyBoxPrice',
        '.offer-price'
      ];

      for (let sel of selectors) {
        const el = document.querySelector(sel);
        if (el) {
          const text = el.innerText?.trim() || el.textContent?.trim();
          // Check if it actually looks like money (contains number)
          if (text && /\d/.test(text)) {
            console.log('[Wist] Found price via:', sel, '=', text);
            return text;
          }
        }
      }
      return "$0.00"; // Give up
    }

    const priceFound = findPrice();
    console.log("💰 Price Found:", priceFound);

    // Get title (try multiple selectors)
    const titleSelectors = [
      '#productTitle',
      'h1.a-size-large',
      'span#productTitle',
      'h1 span'
    ];
    let titleText = "Unknown Item";
    for (const selector of titleSelectors) {
      const el = document.querySelector(selector);
      if (el && el.innerText && el.innerText.trim() !== '') {
        titleText = el.innerText.trim();
        break;
      }
    }

    // Get image (try multiple selectors)
    const imageSelectors = [
      '#landingImage',
      '#imgBlkFront',
      '#main-image',
      'img[data-a-image-name="landingImage"]'
    ];
    let imageUrl = "";
    for (const selector of imageSelectors) {
      const el = document.querySelector(selector);
      if (el && el.src) {
        imageUrl = el.src;
        break;
      }
    }

    const dummyData = {
      title: titleText,
      image: imageUrl,
      price: priceFound
    };

    console.log("Captured Data:", dummyData);
    showCelebrationModal(dummyData);
  }
});

// --- HELPER FUNCTIONS ---

function isOrderConfirmationPage() {
  const url = window.location.href;
  const pageText = document.body.innerText;
  
  // Amazon specific checks
  const isAmazon = url.includes('amazon.com');
  const hasThankYouURL = url.includes('/thankyou') || url.includes('buy/spc/handlers/static-submit');
  const hasSuccessText = pageText.includes("Order placed, thanks") || document.getElementById('box-widget-ref=order-confirmation');

  return isAmazon && (hasThankYouURL || hasSuccessText);
}

function scrapeOrderData() {
  // Scraping the "Thank You" page is hard because details vary.
  // For V1, we try to grab the first image we see, or generic info.
  return {
    title: "your new item", // On real thank you pages, getting the exact title is complex
    image: "", 
    price: ""
  };
}

// 3. The "Just Got It" Pop-up UI
function showCelebrationModal(item) {
  // Prevent duplicate modals
  if (document.getElementById('wist-celebration-modal')) return;

  // Create the Modal HTML
  const modal = document.createElement('div');
  modal.id = 'wist-celebration-modal';
  modal.innerHTML = `
    <div class="wist-modal-content">
      <div class="wist-confetti">🎉</div>
      <h2>Treat Yourself?</h2>
      <p>Did you just buy <strong>${item.title.substring(0, 40)}...</strong>?</p>
      
      ${item.image ? `<div class="wist-img-container"><img src="${item.image}" class="wist-preview-img" /></div>` : ''}

      <div class="wist-actions">
        <button id="wist-btn-yes">Yes, Add to "Just Got It"</button>
        <button id="wist-btn-no">No, skip</button>
      </div>
      <div class="wist-powered">Powered by Wist</div>
    </div>
  `;

  // Inject Wist Brand Styles
  const style = document.createElement('style');
  style.textContent = `
    #wist-celebration-modal {
      position: fixed;
      top: 24px;
      right: 24px;
      z-index: 2147483647 !important; /* Max Z-Index */
      font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      animation: wist-slide-in 0.4s cubic-bezier(0.16, 1, 0.3, 1);
      pointer-events: auto;
    }

    .wist-modal-content {
      background: #ffffff;
      padding: 24px;
      border-radius: 12px; /* Consistent with Dashboard rounded-xl */
      box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04); /* Tailwind shadow-xl */
      width: 320px;
      text-align: center;
      border: 1px solid #e5e7eb; /* Gray-200 */
      pointer-events: auto; /* Ensure content is clickable */
    }

    /* Animated Confetti */
    .wist-confetti { 
      font-size: 32px; 
      margin-bottom: 12px; 
      animation: wist-bounce 1s infinite;
    }

    /* Typography matching Dashboard */
    #wist-celebration-modal h2 { 
      margin: 0 0 8px 0; 
      font-size: 18px; 
      font-weight: 700; 
      color: #111827; /* Gray-900 */
      letter-spacing: -0.025em;
    }

    #wist-celebration-modal p { 
      margin: 0 0 20px 0; 
      color: #6b7280; /* Gray-500 */
      font-size: 14px; 
      line-height: 1.5; 
    }

    /* Image Container */
    .wist-img-container {
      background: #f9fafb; /* Gray-50 */
      border-radius: 8px;
      padding: 12px;
      margin-bottom: 20px;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .wist-preview-img { 
      width: 100px; 
      height: 100px; 
      object-fit: contain; 
      mix-blend-mode: multiply;
    }
    
    .wist-actions { 
      display: flex; 
      flex-direction: column; 
      gap: 12px; 
    }
    
    /* Primary Brand Button (Violet-500) */
    #wist-btn-yes {
      background-color: #8b5cf6 !important; /* Tailwind Violet-500 */
      color: #ffffff !important;
      border: 1px solid transparent !important;
      padding: 10px 16px !important;
      border-radius: 8px !important;
      font-weight: 600 !important;
      font-size: 14px !important;
      cursor: pointer !important;
      display: block !important;
      width: 100% !important;
      margin-bottom: 8px !important;
      box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05) !important;
      transition: all 0.2s !important;
    }
    #wist-btn-yes:hover { 
      background-color: #7c3aed !important; /* Tailwind Violet-600 (Slightly darker for hover) */
      transform: translateY(-1px);
    }
    #wist-btn-yes:active {
      transform: translateY(0);
    }
    
    /* Secondary Button */
    #wist-btn-no {
      background: white; 
      color: #374151; /* Gray-700 */
      border: 1px solid #d1d5db; /* Gray-300 */
      padding: 8px 16px;
      border-radius: 8px;
      font-weight: 500;
      font-size: 13px;
      cursor: pointer; 
      transition: all 0.2s;
    }
    #wist-btn-no:hover { 
      background: #f9fafb; /* Gray-50 */
      border-color: #9ca3af; /* Gray-400 */
      color: #111827;
    }

    .wist-powered { 
      margin-top: 16px; 
      font-size: 10px; 
      color: #9ca3af; 
      font-weight: 600;
      text-transform: uppercase; 
      letter-spacing: 0.05em; 
    }

    @keyframes wist-slide-in {
      from { transform: translateY(-20px); opacity: 0; }
      to { transform: translateY(0); opacity: 1; }
    }
    @keyframes wist-bounce {
      0%, 100% { transform: translateY(0); }
      50% { transform: translateY(-5px); }
    }
  `;

  document.head.appendChild(style);
  document.body.appendChild(modal);

  // Add Button Listeners
  document.getElementById('wist-btn-yes').addEventListener('click', () => {
    // Only run the function. It will handle the closing timing.
    handleJustGotIt(item); 
  });

  document.getElementById('wist-btn-no').addEventListener('click', removeModal);
}

function removeModal() {
  const modal = document.getElementById('wist-celebration-modal');
  if (modal) modal.remove();
}

async function handleJustGotIt(item) {
  const btn = document.getElementById('wist-btn-yes');
  
  // 1. UI Feedback
  btn.innerText = "Saving...";
  btn.style.backgroundColor = "#7c3aed"; // Violet-600

  // 2. Send Message to Background Script (bypasses Mixed Content restrictions)
  chrome.runtime.sendMessage({
    type: 'SAVE_ITEM',
    payload: {
      title: item.title,
      price: item.price,
      image_url: item.image,
      url: window.location.href,
      status: 'purchased'
    }
  }, (response) => {
    // 3. Handle Response
    if (chrome.runtime.lastError) {
      console.error("Runtime Error:", chrome.runtime.lastError);
      btn.innerText = "Connection Failed";
      btn.style.backgroundColor = "#ef4444";
      return;
    }

    if (response && response.success) {
      btn.innerText = "Saved! 🎉";
      btn.style.backgroundColor = "#10b981"; // Green
      console.log("✅ Saved to DB:", response.data);
      setTimeout(removeModal, 2000);
    } else {
      btn.innerText = "Error: " + (response?.error || "Failed");
      btn.style.backgroundColor = "#ef4444"; // Red
      console.error("❌ Save Failed:", response?.error);
      // Don't close modal on error so user can see the message
    }
  });
}