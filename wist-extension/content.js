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
  // Handles European format (1.234,56 or 180,00) where comma is the decimal separator
  let priceValue = 0;
  if (price) {
    let raw = price.toString();
    const hasComma = raw.includes(',');
    const hasDot = raw.includes('.');
    if (hasComma && !hasDot) {
      // "180,00" or "1234,56" — comma is the decimal separator
      raw = raw.replace(/,/, '.');
    } else if (hasComma && hasDot) {
      const lastComma = raw.lastIndexOf(',');
      const lastDot = raw.lastIndexOf('.');
      if (lastComma > lastDot) {
        // "1.234,56" — dot is thousands, comma is decimal
        raw = raw.replace(/\./g, '').replace(',', '.');
      }
      // else "1,234.56" — comma is thousands, dot is decimal (default)
    }
    const priceMatch = raw.replace(/[^0-9.]/g, '');
    priceValue = parseFloat(priceMatch) || 0;
  }

  // Detect stock status
  const outOfStock = detectOutOfStock();

  // Multi-image collection
  const allImages = [];
  const seenUrls = new Set();
  const REVIEW_SELECTORS = '#customer-reviews, #reviews-section, [data-hook="review"], [class*="review"], [class*="Review"], [id*="review"], [id*="Review"], .cr-widget, #cr-media-gallery, [class*="feedback"], [class*="Feedback"], [class*="comment"], [class*="Comment"], [class*="rating"], [class*="Rating"], [class*="testimonial"]';

  function isInsideReview(el) {
    return el.closest && el.closest(REVIEW_SELECTORS);
  }

  function addImg(u, el) {
    if (!u || typeof u !== 'string') return;
    if (el && isInsideReview(el)) return;
    let clean = u.trim();
    if (clean.startsWith('//')) clean = 'https:' + clean;
    if (!clean.startsWith('http')) {
      try { clean = new URL(clean, url).href; } catch { return; }
    }
    const base = clean.split('?')[0].split('#')[0];
    if (seenUrls.has(base)) return;
    if (/placeholder|loading|spinner|logo|icon|avatar|badge|pixel|spacer|1x1|profile|user|review|customer/i.test(base)) return;
    if (/\.svg$/i.test(base)) return;
    seenUrls.add(base);
    allImages.push(clean);
  }

  try {
    const scripts = document.querySelectorAll('script[type="application/ld+json"]');
    for (const s of scripts) {
      try {
        const d = JSON.parse(s.textContent);
        const items = Array.isArray(d) ? d : [d];
        for (const item of items) {
          const product = item['@type'] === 'Product' ? item :
            (item['@graph'] ? item['@graph'].find(g => g['@type'] === 'Product') : null);
          if (!product) continue;
          const imgs = product.image;
          if (Array.isArray(imgs)) imgs.forEach(x => addImg(typeof x === 'string' ? x : x?.url));
          else if (typeof imgs === 'string') addImg(imgs);
          else if (imgs?.url) addImg(imgs.url);
        }
      } catch {}
    }
  } catch {}

  const ogI = document.querySelector('meta[property="og:image"]')?.getAttribute('content');
  if (ogI) addImg(ogI);

  if (domain.includes('amazon.')) {
    document.querySelectorAll('#altImages img, #imageBlock img, .imgTagWrapper img, #landingImage, #imgBlkFront').forEach(el => {
      if (isInsideReview(el)) return;
      const src = el.getAttribute('data-old-hires') || el.src;
      if (src) addImg(src.replace(/\._[A-Z]+\d+_\./, '.'), el);
    });
  } else if (domain.includes('etsy.')) {
    document.querySelectorAll('img[src*="etsystatic.com"], img[data-src*="etsystatic.com"]').forEach(el => {
      if (isInsideReview(el)) return;
      const src = el.getAttribute('data-src') || el.src;
      if (src && src.includes('/il/')) addImg(src, el);
    });
  } else if (domain.includes('target.')) {
    document.querySelectorAll('[data-test="product-image"] img, picture img[src*="scene7"], [class*="slide"] img').forEach(el => {
      if (isInsideReview(el)) return;
      if (el.src) addImg(el.src, el);
    });
  }

  document.querySelectorAll('.product-gallery img, .product-images img, [class*="carousel"] img, [class*="slider"] img, img[itemprop="image"]').forEach(el => {
    if (isInsideReview(el)) return;
    const src = el.getAttribute('data-src') || el.src;
    if (src) addImg(src, el);
  });

  // Large visible images (filtered for reviews)
  document.querySelectorAll('img').forEach(el => {
    if (isInsideReview(el)) return;
    const w = el.naturalWidth || el.width || 0;
    const h = el.naturalHeight || el.height || 0;
    if (w >= 150 && h >= 150) {
      const src = el.getAttribute('data-src') || el.src;
      if (src) addImg(src, el);
    }
  });

  if (image && allImages.length > 0) {
    const primaryBase = image.split('?')[0].split('#')[0];
    const idx = allImages.findIndex(x => x.split('?')[0].split('#')[0] === primaryBase);
    if (idx > 0) { allImages.splice(idx, 1); allImages.unshift(image); }
    else if (idx === -1) { allImages.unshift(image); }
  } else if (image) {
    allImages.unshift(image);
  }

  return {
    title: title || document.title || 'Unknown Item',
    price: priceValue,
    image: image || null,
    images: allImages.slice(0, 20),
    description: description || null,
    url: url,
    retailer: domain.replace('www.', '').replace('m.', '').split('.')[0],
    currency: currencyInfo.code,
    original_price_raw: price || null,
    out_of_stock: outOfStock,
  };
}

function detectOutOfStock() {
  // 1. JSON-LD availability
  const jsonLdScripts = document.querySelectorAll('script[type="application/ld+json"]');
  for (const script of jsonLdScripts) {
    try {
      const data = JSON.parse(script.textContent || '{}');
      const items = Array.isArray(data) ? data : [data];
      for (const item of items) {
        const avail = item?.offers?.availability || item?.availability || '';
        if (/OutOfStock|SoldOut|Discontinued|PreOrder/i.test(avail)) return true;
        if (/InStock|InStoreOnly|OnlineOnly|LimitedAvailability/i.test(avail)) return false;
      }
    } catch (e) {}
  }

  // 2. Common out-of-stock selectors
  const oosSelectors = [
    '[data-test="soldOutBlock"]', '[data-test="outOfStockBlock"]',
    '#outOfStock', '#soldout', '.out-of-stock', '.sold-out',
    '#availability .a-color-price',
    '[class*="OutOfStock"]', '[class*="SoldOut"]',
    '[class*="out-of-stock"]', '[class*="sold-out"]',
  ];
  for (const sel of oosSelectors) {
    const el = document.querySelector(sel);
    if (el && el.offsetParent !== null) return true;
  }

  // 3. Amazon-specific availability text
  const availEl = document.querySelector('#availability span, #availability');
  if (availEl) {
    const text = availEl.textContent?.trim().toLowerCase() || '';
    if (/currently unavailable|out of stock|unavailable/i.test(text)) return true;
  }

  // 4. Visible text patterns (limited scope to avoid false positives)
  const textElements = document.querySelectorAll('[class*="stock"], [class*="availability"], [data-test*="stock"], [data-test*="availability"]');
  for (const el of textElements) {
    const text = el.textContent?.trim().toLowerCase() || '';
    if (/out of stock|sold out|currently unavailable|no longer available/i.test(text)) return true;
  }

  return false;
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
  
  // Title: agent sites render product names in various elements
  // Strategy 1: Try specific selectors common to these SPAs
  const titleSelectors = [
    '[class*="goodsName"]', '[class*="goods-name"]', '[class*="GoodsName"]',
    '[class*="goodsTitle"]', '[class*="goods-title"]', '[class*="GoodsTitle"]',
    '[class*="product-name"]', '[class*="productName"]', '[class*="ProductName"]',
    '[class*="product-title"]', '[class*="productTitle"]', '[class*="ProductTitle"]',
    '[class*="item-name"]', '[class*="itemName"]', '[class*="ItemName"]',
    '[class*="item-title"]', '[class*="itemTitle"]', '[class*="ItemTitle"]',
    '[class*="detail-title"]', '[class*="detailTitle"]',
    '[class*="info-name"]', '[class*="infoName"]',
    '[class*="shopname"]', '[class*="ShopName"]',
    '.goods-title', '.product-title', '.item-title',
    'h1', 'h2',
  ];
  for (const sel of titleSelectors) {
    try {
      const els = document.querySelectorAll(sel);
      for (const el of els) {
        const text = el.textContent?.trim();
        // Must be substantial (not just a label) and not too long (not a paragraph)
        if (text && text.length > 8 && text.length < 500 && !/^(Home|Shop|Cart|Login|Kakobuy|Detail|Loading)/i.test(text)) {
          title = text;
          break;
        }
      }
      if (title) break;
    } catch (e) {}
  }

  // Strategy 2: scan all visible text elements for the longest product-like text
  if (!title) {
    let bestCandidate = null;
    let bestLen = 0;
    const candidates = document.querySelectorAll('h1, h2, h3, [class*="title"], [class*="name"], [class*="Title"], [class*="Name"]');
    for (const el of candidates) {
      const text = el.textContent?.trim();
      if (text && text.length > 10 && text.length < 300 && text.length > bestLen) {
        if (!/kakobuy|superbuy|wegobuy|pandabuy|cssbuy|login|register|cart|home/i.test(text)) {
          bestCandidate = text;
          bestLen = text.length;
        }
      }
    }
    if (bestCandidate) title = bestCandidate;
  }

  // Strategy 3: page title (often contains product name)
  if (!title) {
    const pageTitle = document.title || '';
    const cleaned = pageTitle.replace(/[-|–]\s*(Kakobuy|Superbuy|Wegobuy|Pandabuy|CSSBuy).*/i, '').trim();
    if (cleaned.length > 5) title = cleaned;
  }

  // Strategy 4: og:title meta tag
  if (!title) {
    const ogT = document.querySelector('meta[property="og:title"]');
    if (ogT) {
      const text = ogT.getAttribute('content')?.trim();
      if (text && text.length > 5) title = text;
    }
  }

  // Strategy 5: extract from embedded JSON data in scripts
  if (!title) {
    try {
      const html = document.documentElement.innerHTML;
      const namePatterns = [
        /"goodsName"\s*:\s*"([^"]+)"/,
        /"goods_name"\s*:\s*"([^"]+)"/,
        /"productName"\s*:\s*"([^"]+)"/,
        /"product_name"\s*:\s*"([^"]+)"/,
        /"title"\s*:\s*"([^"]{10,200})"/,
        /"name"\s*:\s*"([^"]{10,200})"/,
        /"itemName"\s*:\s*"([^"]+)"/,
      ];
      for (const p of namePatterns) {
        const m = html.match(p);
        if (m && m[1] && m[1].length > 5) {
          title = m[1];
          break;
        }
      }
    } catch (e) {}
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
    '[class*="mainImage"] img', '[class*="MainImage"] img',
    '[class*="goodsImage"] img', '[class*="goods-image"] img',
    '[class*="product-image"] img', '[class*="productImage"] img',
    '[class*="gallery"] img', '[class*="Gallery"] img',
    '.swiper-slide img', 'img[class*="product"]', 'img[class*="goods"]',
    'img[src*="cbu01.alicdn"]', 'img[src*="img.alicdn"]',
    '.product-image img', '.goods-image img',
    'meta[property="og:image"]'
  ];
  for (const sel of imageSelectors) {
    const el = document.querySelector(sel);
    if (el) {
      const src = el.getAttribute('content') || el.getAttribute('data-src') || el.src;
      if (src && !src.includes('placeholder') && !src.includes('svg') && !src.includes('logo')) {
        image = src.startsWith('//') ? 'https:' + src : src;
        break;
      }
    }
  }

  // Image fallback: find the largest image on the page
  if (!image) {
    const allImgs = document.querySelectorAll('img');
    let best = null;
    let bestSize = 0;
    for (const img of allImgs) {
      const w = img.naturalWidth || img.width || 0;
      const h = img.naturalHeight || img.height || 0;
      const size = w * h;
      if (size > bestSize && !img.src.includes('logo') && !img.src.includes('icon') && !img.src.includes('avatar') && img.src.length > 10) {
        best = img.src;
        bestSize = size;
      }
    }
    if (best) image = best;
  }
  
  const ogDesc = document.querySelector('meta[property="og:description"], meta[name="description"]');
  if (ogDesc) description = ogDesc.getAttribute('content')?.substring(0, 500);
  
  return { title, price, image, description };
}

// Currency detection from raw price strings and domain
function detectCurrency(rawPrice, domain) {
  if (!rawPrice && !domain) return { code: 'USD', symbol: '$' };
  
  const priceStr = (rawPrice || '').toString();
  
  // Symbol-based detection (check unique symbols first)
  if (/¥|￥/.test(priceStr)) {
    if (domain && (domain.includes('.jp') || domain.includes('amazon.co.jp') || domain.includes('rakuten'))) {
      return { code: 'JPY', symbol: '¥' };
    }
    return { code: 'CNY', symbol: '¥' };
  }
  if (/€/.test(priceStr)) return { code: 'EUR', symbol: '€' };
  if (/£/.test(priceStr)) return { code: 'GBP', symbol: '£' };
  if (/₩/.test(priceStr)) return { code: 'KRW', symbol: '₩' };
  if (/₹/.test(priceStr)) return { code: 'INR', symbol: '₹' };
  if (/₡/.test(priceStr)) return { code: 'CRC', symbol: '₡' };
  if (/₺/.test(priceStr)) return { code: 'TRY', symbol: '₺' };
  if (/₽/.test(priceStr)) return { code: 'RUB', symbol: '₽' };
  if (/R\$/.test(priceStr)) return { code: 'BRL', symbol: 'R$' };
  if (/RD\$/.test(priceStr)) return { code: 'DOP', symbol: 'RD$' };
  if (/MX\$/.test(priceStr)) return { code: 'MXN', symbol: 'MX$' };
  if (/CA\$|CAD/.test(priceStr)) return { code: 'CAD', symbol: 'CA$' };
  if (/A\$|AU\$|AUD/.test(priceStr)) return { code: 'AUD', symbol: 'A$' };
  if (/S\//.test(priceStr)) return { code: 'PEN', symbol: 'S/' };
  if (/Q\s?\d/.test(priceStr)) return { code: 'GTQ', symbol: 'Q' };
  if (/\$/.test(priceStr)) {
    // Generic dollar sign — determine which dollar based on domain
    if (domain) {
      if (domain.includes('.mx') || domain.includes('amazon.com.mx') || domain.includes('mercadolibre.com.mx')) return { code: 'MXN', symbol: 'MX$' };
      if (domain.includes('.ca') || domain.includes('amazon.ca')) return { code: 'CAD', symbol: 'CA$' };
      if (domain.includes('.au') || domain.includes('amazon.com.au')) return { code: 'AUD', symbol: 'A$' };
      if (domain.includes('.ar') || domain.includes('mercadolibre.com.ar')) return { code: 'ARS', symbol: 'AR$' };
      if (domain.includes('.cl') || domain.includes('mercadolibre.cl')) return { code: 'CLP', symbol: 'CL$' };
      if (domain.includes('.co') && !domain.includes('.com') || domain.includes('mercadolibre.com.co')) return { code: 'COP', symbol: 'COL$' };
      if (domain.includes('.do')) return { code: 'DOP', symbol: 'RD$' };
      if (domain.includes('.ni')) return { code: 'NIO', symbol: 'C$' };
    }
    return { code: 'USD', symbol: '$' };
  }
  
  // Domain-based fallback (no recognizable symbol found)
  if (domain) {
    if (domain.includes('taobao.') || domain.includes('tmall.') || domain.includes('1688.') || 
        domain.includes('kakobuy.') || domain.includes('superbuy.') || domain.includes('wegobuy.') ||
        domain.includes('pandabuy.') || domain.includes('cssbuy.')) {
      return { code: 'CNY', symbol: '¥' };
    }
    if (domain.includes('.jp') || domain.includes('rakuten')) return { code: 'JPY', symbol: '¥' };
    if (domain.includes('.co.uk') || domain.includes('amazon.co.uk')) return { code: 'GBP', symbol: '£' };
    if (domain.includes('.de') || domain.includes('.fr') || domain.includes('.it') || domain.includes('.es') ||
        domain.includes('.nl') || domain.includes('.be') || domain.includes('.at') || domain.includes('.pt')) {
      return { code: 'EUR', symbol: '€' };
    }
    if (domain.includes('.kr')) return { code: 'KRW', symbol: '₩' };
    if (domain.includes('.in') || domain.includes('amazon.in')) return { code: 'INR', symbol: '₹' };
    if (domain.includes('.mx') || domain.includes('mercadolibre.com.mx')) return { code: 'MXN', symbol: 'MX$' };
    if (domain.includes('.gt')) return { code: 'GTQ', symbol: 'Q' };
    if (domain.includes('.sv')) return { code: 'USD', symbol: '$' }; // El Salvador uses USD
    if (domain.includes('.hn')) return { code: 'HNL', symbol: 'L' };
    if (domain.includes('.ni')) return { code: 'NIO', symbol: 'C$' };
    if (domain.includes('.cr')) return { code: 'CRC', symbol: '₡' };
    if (domain.includes('.pe')) return { code: 'PEN', symbol: 'S/' };
    if (domain.includes('.ar')) return { code: 'ARS', symbol: 'AR$' };
    if (domain.includes('.cl')) return { code: 'CLP', symbol: 'CL$' };
    if (domain.includes('.br')) return { code: 'BRL', symbol: 'R$' };
    if (domain.includes('.tr')) return { code: 'TRY', symbol: '₺' };
    if (domain.includes('.ru')) return { code: 'RUB', symbol: '₽' };
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
    }
  });
}

// ============================================================================
// FLOATING PANEL (FAB + Side Drawer UI)
// ============================================================================

(function initFloatingPanel() {
  try {
  if (window.__wistFloatingInit) return;
  window.__wistFloatingInit = true;

  const loc = window.location.href;
  console.log('[Wist] Floating panel init on', loc);
  if (loc.startsWith('chrome') || loc.includes('wishlist.nuvio.cloud')) {
    console.log('[Wist] Skipping — own page or chrome://');
    return;
  }

  let fabVisible = false;
  let panelOpen = false;
  let panelProduct = null;
  let isPrivate = true;
  let fabHost = null;
  let drawerHost = null;
  let fabShadow = null;
  let drawerShadow = null;
  let isDragging = false;

  function tryLoadMode() {
    try {
      chrome.storage.local.get('wist_ui_mode', (result) => {
        if (chrome.runtime.lastError) {
          console.log('[Wist] Storage error:', chrome.runtime.lastError);
          return;
        }
        console.log('[Wist] Current ui_mode:', result.wist_ui_mode);
        if (result.wist_ui_mode === 'floating') injectFAB();
      });
    } catch (e) {
      console.warn('[Wist] chrome.storage not available, retrying...', e.message);
      setTimeout(tryLoadMode, 1000);
    }
  }

  if (document.body) {
    tryLoadMode();
  } else {
    document.addEventListener('DOMContentLoaded', tryLoadMode);
  }

  try {
    chrome.storage.onChanged.addListener((changes, area) => {
      if (changes.wist_ui_mode) {
        const newVal = changes.wist_ui_mode.newValue;
        console.log('[Wist] Mode changed to:', newVal);
        if (newVal === 'floating') {
          if (!fabVisible) injectFAB();
        } else {
          removeFAB();
        }
      }
    });
  } catch (e) {
    console.warn('[Wist] Could not listen for storage changes:', e.message);
  }

  async function injectFAB() {
    console.log('[Wist] injectFAB called, fabHost exists:', !!fabHost);
    if (fabHost) return;
    fabVisible = true;

    // Small square flush to viewport edge; drag slides along that edge, switch edge when pointer leaves the "corridor"
    const EDGE_PAD = 6;
    const EDGE_CORRIDOR = 56;
    const MARK_SIZE = 40; // square width & height
    let dockEdge = 'right';

    function hostSize() {
      return { w: MARK_SIZE, h: MARK_SIZE };
    }

    function pickEdge(cx, cy) {
      const iw = window.innerWidth;
      const ih = window.innerHeight;
      const dL = cx;
      const dR = iw - cx;
      const dT = cy;
      const dB = ih - cy;
      const m = Math.min(dL, dR, dT, dB);
      if (m === dR) return 'right';
      if (m === dL) return 'left';
      if (m === dT) return 'top';
      return 'bottom';
    }

    function distToEdge(edge, cx, cy) {
      const iw = window.innerWidth;
      const ih = window.innerHeight;
      switch (edge) {
        case 'right':
          return iw - cx;
        case 'left':
          return cx;
        case 'top':
          return cy;
        case 'bottom':
          return ih - cy;
        default:
          return 9999;
      }
    }

    /** Keep sliding on the same edge until the pointer moves clearly away toward another side */
    function pickEdgeWhileDragging(cx, cy, prevEdge) {
      if (prevEdge && distToEdge(prevEdge, cx, cy) <= EDGE_CORRIDOR) {
        return prevEdge;
      }
      return pickEdge(cx, cy);
    }

    fabHost = document.createElement('div');
    fabHost.id = 'wist-fab-host';
    fabHost.style.cssText =
      'position:fixed !important;z-index:2147483646 !important;display:block !important;visibility:visible !important;opacity:1 !important;pointer-events:auto !important;margin:0 !important;padding:0 !important;border:none !important;background:none !important;transform:none !important;overflow:visible !important;';
    fabShadow = fabHost.attachShadow({ mode: 'open' });

    const fabStyle = document.createElement('style');
    fabStyle.textContent = `
      :host { display:block; }
      button {
        width:100%;height:100%;border:none;cursor:grab;
        background:linear-gradient(168deg,#b46bff 0%,#7c3aed 42%,#4c1d95 100%);
        display:flex;align-items:center;justify-content:center;
        transition:filter 0.2s,box-shadow 0.2s;
        animation:fab-in 0.45s cubic-bezier(0.16,1,0.3,1);
        user-select:none;-webkit-user-select:none;
        -webkit-tap-highlight-color:transparent;
        box-sizing:border-box;
      }
      button:hover:not(:active){filter:brightness(1.06);}
      button:active{cursor:grabbing;filter:brightness(0.95);}
      .wist-bm-inner{
        display:flex;align-items:center;justify-content:center;
        width:100%;height:100%;position:relative;padding:0;box-sizing:border-box;
      }
      /* Square: one side flush to viewport; slight radius on the inner corners only */
      button[data-edge="right"]{
        border-radius:8px 0 0 8px;
        box-shadow:-3px 1px 12px rgba(76,29,149,0.35),inset 2px 0 6px -2px rgba(255,255,255,0.18);
      }
      button[data-edge="left"]{
        border-radius:0 8px 8px 0;
        box-shadow:3px 1px 12px rgba(76,29,149,0.35),inset -2px 0 6px -2px rgba(255,255,255,0.18);
      }
      button[data-edge="bottom"]{
        border-radius:8px 8px 0 0;
        box-shadow:0 -3px 12px rgba(76,29,149,0.35),inset 0 2px 6px -2px rgba(255,255,255,0.15);
      }
      button[data-edge="top"]{
        border-radius:0 0 8px 8px;
        box-shadow:0 3px 12px rgba(76,29,149,0.35),inset 0 -2px 6px -2px rgba(255,255,255,0.15);
      }
      @keyframes fab-in{from{opacity:0;transform:scale(0.92);}to{opacity:1;transform:scale(1);}}
    `;
    fabShadow.appendChild(fabStyle);

    const fab = document.createElement('button');
    fab.type = 'button';
    fab.setAttribute('aria-label', 'Wist — drag along the edge to move, pull inward to switch sides');
    const logoUrl = chrome.runtime.getURL('white_logo.png');
    fab.innerHTML = `<span class="wist-bm-inner"><img src="${logoUrl}" alt="" style="width:22px;height:22px;object-fit:contain;pointer-events:none;filter:drop-shadow(0 1px 2px rgba(0,0,0,0.25));" /></span>`;

    function positionFab(edge, opts) {
      const iw = window.innerWidth;
      const ih = window.innerHeight;
      const { w, h } = hostSize();
      dockEdge = edge;
      fabHost.style.setProperty('left', 'auto', 'important');
      fabHost.style.setProperty('right', 'auto', 'important');
      fabHost.style.setProperty('top', 'auto', 'important');
      fabHost.style.setProperty('bottom', 'auto', 'important');
      let top;
      let left;
      if (edge === 'right') {
        const cy =
          opts.clientY != null ? opts.clientY : opts.along != null ? opts.along + h / 2 : ih / 2;
        top = Math.max(EDGE_PAD, Math.min(ih - h - EDGE_PAD, cy - h / 2));
        fabHost.style.setProperty('right', '0', 'important');
        fabHost.style.setProperty('top', `${top}px`, 'important');
      } else if (edge === 'left') {
        const cy =
          opts.clientY != null ? opts.clientY : opts.along != null ? opts.along + h / 2 : ih / 2;
        top = Math.max(EDGE_PAD, Math.min(ih - h - EDGE_PAD, cy - h / 2));
        fabHost.style.setProperty('left', '0', 'important');
        fabHost.style.setProperty('top', `${top}px`, 'important');
      } else if (edge === 'bottom') {
        const cx =
          opts.clientX != null ? opts.clientX : opts.along != null ? opts.along + w / 2 : iw / 2;
        left = Math.max(EDGE_PAD, Math.min(iw - w - EDGE_PAD, cx - w / 2));
        fabHost.style.setProperty('bottom', '0', 'important');
        fabHost.style.setProperty('left', `${left}px`, 'important');
      } else {
        const cx =
          opts.clientX != null ? opts.clientX : opts.along != null ? opts.along + w / 2 : iw / 2;
        left = Math.max(EDGE_PAD, Math.min(iw - w - EDGE_PAD, cx - w / 2));
        fabHost.style.setProperty('top', '0', 'important');
        fabHost.style.setProperty('left', `${left}px`, 'important');
      }
      fabHost.style.setProperty('width', `${w}px`, 'important');
      fabHost.style.setProperty('height', `${h}px`, 'important');
      fab.dataset.edge = edge;
      const img = fab.querySelector('img');
      if (img) {
        img.style.width = '22px';
        img.style.height = '22px';
      }
    }

    let savedPos = null;
    try {
      const result = await new Promise((resolve) => {
        chrome.storage.local.get('wist_fab_position', resolve);
      });
      savedPos = result?.wist_fab_position || null;
    } catch (e) {
      console.warn('[Wist] Could not load FAB position:', e);
    }

    if (savedPos && savedPos.v === 2 && savedPos.edge && typeof savedPos.along === 'number') {
      positionFab(savedPos.edge, { along: savedPos.along });
    } else if (savedPos && savedPos.left != null && savedPos.top != null) {
      const cx = savedPos.left + 20;
      const cy = savedPos.top + 20;
      positionFab(pickEdge(cx, cy), { clientX: cx, clientY: cy });
    } else {
      const ih = window.innerHeight;
      positionFab('right', { along: Math.max(EDGE_PAD, ih - MARK_SIZE - 24) });
    }

    let clickStartTime = 0;
    let clickStartX = 0;
    let clickStartY = 0;
    let hasMoved = false;

    function handlePointerDown(e) {
      const clientX = e.clientX ?? e.touches?.[0]?.clientX ?? 0;
      const clientY = e.clientY ?? e.touches?.[0]?.clientY ?? 0;
      clickStartTime = Date.now();
      clickStartX = clientX;
      clickStartY = clientY;
      hasMoved = false;
      isDragging = false;

      const handleMove = (ev) => {
        const cx = ev.clientX ?? ev.touches?.[0]?.clientX ?? 0;
        const cy = ev.clientY ?? ev.touches?.[0]?.clientY ?? 0;
        const dist = Math.hypot(cx - clickStartX, cy - clickStartY);
        if (dist > 6) {
          hasMoved = true;
          if (!isDragging) {
            isDragging = true;
            fab.style.cursor = 'grabbing';
          }
          if (ev.touches) ev.preventDefault();
          const edge = pickEdgeWhileDragging(cx, cy, dockEdge);
          positionFab(edge, { clientX: cx, clientY: cy });
        }
      };

      const handleEnd = async () => {
        if (isDragging) {
          const rect = fabHost.getBoundingClientRect();
          const along = dockEdge === 'right' || dockEdge === 'left' ? rect.top : rect.left;
          try {
            await new Promise((resolve) => {
              chrome.storage.local.set({ wist_fab_position: { v: 2, edge: dockEdge, along } }, resolve);
            });
          } catch (err) {
            console.warn('[Wist] Could not save FAB dock:', err);
          }
          fab.style.cursor = 'grab';
          isDragging = false;
        } else if (!hasMoved && Date.now() - clickStartTime < 350) {
          openPanel();
        }
        document.removeEventListener('mousemove', handleMove);
        document.removeEventListener('mouseup', handleEnd);
        document.removeEventListener('touchmove', handleMove);
        document.removeEventListener('touchend', handleEnd);
      };

      document.addEventListener('mousemove', handleMove);
      document.addEventListener('mouseup', handleEnd);
      document.addEventListener('touchmove', handleMove, { passive: false });
      document.addEventListener('touchend', handleEnd);
    }

    fab.addEventListener('mousedown', handlePointerDown);
    fab.addEventListener('touchstart', handlePointerDown, { passive: false });

    const wistFabOnResize = function () {
      if (!fabHost) return;
      const rect = fabHost.getBoundingClientRect();
      const along = dockEdge === 'right' || dockEdge === 'left' ? rect.top : rect.left;
      positionFab(dockEdge, { along });
    };
    fabHost._wistFabResize = wistFabOnResize;
    window.addEventListener('resize', wistFabOnResize, { passive: true });

    fabShadow.appendChild(fab);
    (document.body || document.documentElement).appendChild(fabHost);
    console.log('[Wist] FAB injected into page, host:', fabHost.isConnected);

    drawerHost = document.createElement('div');
    drawerHost.id = 'wist-drawer-host';
    drawerHost.style.cssText = 'position:fixed !important;top:0 !important;left:0 !important;right:0 !important;bottom:0 !important;width:100vw !important;height:100vh !important;z-index:2147483647 !important;pointer-events:none !important;margin:0 !important;padding:0 !important;border:none !important;background:none !important;';
    drawerShadow = drawerHost.attachShadow({ mode: 'open' });

    const drawerStyle = document.createElement('style');
    drawerStyle.textContent = getDrawerStyles();
    drawerShadow.appendChild(drawerStyle);

    const backdrop = document.createElement('div');
    backdrop.id = 'wist-backdrop';
    backdrop.addEventListener('click', closePanel);
    drawerShadow.appendChild(backdrop);

    const panel = document.createElement('div');
    panel.id = 'wist-drawer';
    panel.innerHTML = getDrawerHTML();
    drawerShadow.appendChild(panel);

    (document.body || document.documentElement).appendChild(drawerHost);
  }

  function removeFAB() {
    if (fabHost) {
      if (fabHost._wistFabResize) {
        window.removeEventListener('resize', fabHost._wistFabResize);
        fabHost._wistFabResize = null;
      }
      fabHost.remove();
      fabHost = null;
      fabShadow = null;
    }
    if (drawerHost) { drawerHost.remove(); drawerHost = null; drawerShadow = null; }
    fabVisible = false;
    panelOpen = false;
  }

  function openPanel() {
    console.log('[Wist] openPanel called, drawerShadow:', !!drawerShadow, 'panelOpen:', panelOpen);
    if (!drawerShadow || panelOpen) return;
    panelOpen = true;
    drawerHost.style.setProperty('pointer-events', 'auto', 'important');
    const backdrop = drawerShadow.querySelector('#wist-backdrop');
    const drawer = drawerShadow.querySelector('#wist-drawer');
    console.log('[Wist] backdrop:', !!backdrop, 'drawer:', !!drawer);
    if (backdrop) backdrop.classList.add('visible');
    if (drawer) drawer.classList.add('open');
    if (fabHost) fabHost.style.setProperty('display', 'none', 'important');
    setTimeout(() => loadPanelData(), 50);
  }

  function closePanel() {
    if (!drawerShadow) return;
    panelOpen = false;
    drawerHost.style.setProperty('pointer-events', 'none', 'important');
    const backdrop = drawerShadow.querySelector('#wist-backdrop');
    const drawer = drawerShadow.querySelector('#wist-drawer');
    if (backdrop) backdrop.classList.remove('visible');
    if (drawer) drawer.classList.remove('open');
    if (fabHost) fabHost.style.setProperty('display', 'block', 'important');
  }

  function loadPanelData() {
    if (!drawerShadow) return;
    const loadingEl = drawerShadow.querySelector('#wist-p-loading');
    const contentEl = drawerShadow.querySelector('#wist-p-content');
    const successEl = drawerShadow.querySelector('#wist-p-success');

    if (loadingEl) loadingEl.style.display = 'flex';
    if (contentEl) contentEl.style.display = 'none';
    if (successEl) successEl.style.display = 'none';

    try {
      const data = scrapeCurrentPage();
      panelProduct = { ...data, image_url: data.image || '' };
      renderPanelContent(data);
    } catch (err) {
      console.error('[Wist] Scrape error in panel:', err);
      panelProduct = { url: window.location.href, title: document.title || '', price: 0, image: '', images: [], retailer: '', currency: 'USD' };
      renderPanelContent(panelProduct);
    }
    if (loadingEl) loadingEl.style.display = 'none';
    if (contentEl) contentEl.style.display = 'block';
  }

  function renderPanelContent(data) {
    if (!drawerShadow) return;
    const s = drawerShadow;

    const titleInput = s.querySelector('#wist-p-title');
    if (titleInput) titleInput.value = data.title || '';

    const priceInput = s.querySelector('#wist-p-price');
    if (priceInput) priceInput.value = data.price || '';

    const retailerEl = s.querySelector('#wist-p-retailer .wist-p-chip-text') || s.querySelector('#wist-p-retailer');
    if (retailerEl) retailerEl.textContent = data.retailer || '';

    const currencyEl = s.querySelector('#wist-p-currency');
    if (currencyEl) currencyEl.textContent = data.currency || 'USD';

    const mainImg = s.querySelector('#wist-p-main-img');
    if (mainImg) {
      mainImg.src = data.image || '';
      mainImg.style.display = data.image ? 'block' : 'none';
    }

    const gallery = s.querySelector('#wist-p-gallery');
    if (gallery) {
      gallery.innerHTML = '';
      const images = data.images || [];
      if (images.length > 1) {
        gallery.style.display = 'flex';
        images.forEach((src, i) => {
          const thumb = document.createElement('img');
          thumb.className = 'wist-p-thumb' + (i === 0 ? ' selected' : '');
          thumb.src = src;
          thumb.onerror = function() { this.remove(); };
          thumb.addEventListener('click', () => {
            gallery.querySelectorAll('.wist-p-thumb').forEach(t => t.classList.remove('selected'));
            thumb.classList.add('selected');
            if (mainImg) { mainImg.src = src; mainImg.style.display = 'block'; }
            panelProduct.image_url = src;
          });
          gallery.appendChild(thumb);
        });
      } else {
        gallery.style.display = 'none';
      }
    }

    wireUpEvents();
  }

  function wireUpEvents() {
    if (!drawerShadow) return;
    const s = drawerShadow;

    const closeBtn = s.querySelector('#wist-p-close');
    if (closeBtn) closeBtn.onclick = closePanel;

    const privacyBtn = s.querySelector('#wist-p-privacy');
    const privacySwitch = s.querySelector('#wist-p-privacy-switch');
    const privacyText = s.querySelector('#wist-p-privacy-text');
    if (privacyBtn) {
      privacyBtn.onclick = () => {
        isPrivate = !isPrivate;
        if (privacySwitch) privacySwitch.classList.toggle('active', !isPrivate);
        if (privacyText) privacyText.textContent = isPrivate ? 'Private' : 'Public';
      };
    }

    const saveBtn = s.querySelector('#wist-p-save');
    if (saveBtn) {
      saveBtn.onclick = () => {
        if (!panelProduct) return;
        const titleInput = s.querySelector('#wist-p-title');
        const priceInput = s.querySelector('#wist-p-price');

        const payload = {
          url: panelProduct.url || window.location.href,
          title: titleInput?.value || panelProduct.title || 'Untitled',
          price: parseFloat(priceInput?.value) || panelProduct.price || 0,
          image_url: panelProduct.image_url || '',
          retailer: panelProduct.retailer || '',
          currency: panelProduct.currency || 'USD',
          is_public: !isPrivate,
          collection_id: null,
        };

        saveBtn.textContent = 'Saving...';
        saveBtn.disabled = true;

        chrome.runtime.sendMessage({ action: 'SAVE_ITEM', data: payload }, (response) => {
          const noticeEl = s.querySelector('#wist-p-limit-notice');
          const upEl = s.querySelector('#wist-p-upgrade');
          const descEl = s.querySelector('#wist-p-limit-desc');
          if (noticeEl) noticeEl.style.display = 'none';
          if (upEl) upEl.removeAttribute('href');
          if (chrome.runtime.lastError) {
            saveBtn.textContent = 'Error';
            saveBtn.style.background = '#ef4444';
            setTimeout(() => { saveBtn.textContent = 'Save to Wist'; saveBtn.disabled = false; saveBtn.style.background = ''; }, 2000);
            return;
          }
          if (response && response.success) {
            const contentEl = s.querySelector('#wist-p-content');
            const successEl = s.querySelector('#wist-p-success');
            if (contentEl) contentEl.style.display = 'none';
            if (successEl) successEl.style.display = 'flex';
            setTimeout(() => {
              closePanel();
              if (contentEl) contentEl.style.display = 'block';
              if (successEl) successEl.style.display = 'none';
              saveBtn.textContent = 'Save to Wist';
              saveBtn.disabled = false;
              saveBtn.style.background = '';
            }, 2000);
          } else {
            const loginNeed =
              response?.error?.includes('logged in') ||
              response?.error?.includes('Token') ||
              response?.error?.includes('Unauthorized');
            if (response?.upgrade && response?.upgradeUrl && noticeEl && upEl) {
              noticeEl.style.display = 'block';
              upEl.href = response.upgradeUrl;
              if (descEl) {
                const lim = response.limit != null ? Number(response.limit) : 100;
                const cur = response.current != null ? Number(response.current) : lim;
                descEl.textContent =
                  `You're using ${cur} of ${lim} items on your current plan. Upgrade for unlimited saves and smarter tracking.`;
              }
              saveBtn.textContent = 'Limit reached';
            } else {
              saveBtn.textContent = loginNeed ? 'Login Required' : 'Error';
            }
            saveBtn.style.background = '#ef4444';
            const resetMs = response?.upgrade ? 12000 : 2500;
            setTimeout(() => {
              saveBtn.textContent = 'Save to Wist';
              saveBtn.disabled = false;
              saveBtn.style.background = '';
              if (noticeEl) noticeEl.style.display = 'none';
              if (upEl) upEl.removeAttribute('href');
            }, resetMs);
          }
        });
      };
    }
  }

  function getDrawerHTML() {
    return `
      <div id="wist-p-header">
        <div class="wist-p-header-left">
          <span class="wist-p-brand">
            <img class="wist-p-logo" src="${chrome.runtime.getURL('icons/icon48.png')}" width="20" height="20" alt="Wist" style="border-radius:4px;" />
            Wist
          </span>
          <span class="wist-p-subtitle">Save to wishlist</span>
        </div>
        <button id="wist-p-close" class="wist-p-close-btn" aria-label="Close">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>
      <div id="wist-p-loading" style="display:none;align-items:center;justify-content:center;padding:80px 0;">
        <div class="wist-p-loader">
          <div class="wist-p-spinner"></div>
          <span class="wist-p-loader-text">Detecting product...</span>
        </div>
      </div>
      <div id="wist-p-content" style="display:none;">
        <div class="wist-p-img-section">
          <img id="wist-p-main-img" class="wist-p-main-img" src="" alt="Product" />
        </div>
        <div id="wist-p-gallery" class="wist-p-gallery"></div>
        <div class="wist-p-divider"></div>
        <div class="wist-p-form">
          <div class="wist-p-field">
            <label class="wist-p-label">Title</label>
            <input id="wist-p-title" type="text" class="wist-p-input" placeholder="Product title" />
          </div>
          <div class="wist-p-row">
            <div class="wist-p-field" style="flex:1;">
              <label class="wist-p-label">Price</label>
              <div class="wist-p-price-wrap">
                <span class="wist-p-price-symbol">$</span>
                <input id="wist-p-price" type="text" class="wist-p-input wist-p-input-price" placeholder="0.00" />
              </div>
            </div>
            <div class="wist-p-field" style="flex:0 0 auto;">
              <label class="wist-p-label">Currency</label>
              <span id="wist-p-currency" class="wist-p-chip">USD</span>
            </div>
            <div class="wist-p-field" style="flex:0 0 auto;">
              <label class="wist-p-label">Store</label>
              <span id="wist-p-retailer" class="wist-p-chip wist-p-chip-store">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/></svg>
                <span class="wist-p-chip-text">Unknown</span>
              </span>
            </div>
          </div>
          <div id="wist-p-privacy" class="wist-p-privacy">
            <div class="wist-p-privacy-left">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
              <span id="wist-p-privacy-text" class="wist-p-privacy-label">Private</span>
            </div>
            <div id="wist-p-privacy-switch" class="wist-p-switch">
              <div class="wist-p-knob"></div>
            </div>
          </div>
          <div id="wist-p-limit-notice" class="wist-p-limit-notice" style="display:none;" role="alert">
            <div class="wist-p-limit-row">
              <div class="wist-p-limit-icon" aria-hidden="true">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              </div>
              <div class="wist-p-limit-text">
                <strong class="wist-p-limit-title">Plan limit reached</strong>
                <p id="wist-p-limit-desc" class="wist-p-limit-desc"></p>
              </div>
            </div>
            <a id="wist-p-upgrade" href="#" target="_blank" rel="noopener noreferrer" class="wist-p-upgrade-cta">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>
              Upgrade plan
            </a>
          </div>
          <button id="wist-p-save" class="wist-p-save-btn">
            <svg class="wist-p-save-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z"/></svg>
            Save to Wist
          </button>
        </div>
      </div>
      <div id="wist-p-success" style="display:none;flex-direction:column;align-items:center;justify-content:center;padding:80px 24px;text-align:center;">
        <div class="wist-p-success-ring">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#16a34a" stroke-width="2" stroke-linecap="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
        </div>
        <div class="wist-p-success-title">Saved to wishlist</div>
        <div class="wist-p-success-sub">We'll track the price and notify you of any drops.</div>
      </div>
    `;
  }

  function getDrawerStyles() {
    return `
      :host { display:block !important; width:100% !important; height:100% !important; }
      * { box-sizing:border-box; margin:0; padding:0; }

      #wist-backdrop {
        position:absolute; top:0; left:0; right:0; bottom:0;
        background:rgba(0,0,0,0); transition:background 0.35s ease;
        pointer-events:none;
      }
      #wist-backdrop.visible { background:rgba(0,0,0,0.35); pointer-events:auto; backdrop-filter:blur(2px); -webkit-backdrop-filter:blur(2px); }

      #wist-drawer {
        position:absolute; top:12px; right:12px; bottom:12px;
        width:380px; max-width:calc(100vw - 24px);
        background:#fff;
        border-radius:16px;
        box-shadow:0 24px 48px -12px rgba(0,0,0,0.18), 0 0 0 1px rgba(0,0,0,0.04);
        transform:translateX(calc(100% + 24px));
        transition:transform 0.4s cubic-bezier(0.16,1,0.3,1);
        display:flex; flex-direction:column;
        font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif;
        font-size:14px; color:#18181b; letter-spacing:-0.01em;
        overflow:hidden;
        pointer-events:auto;
      }
      #wist-drawer.open{transform:translateX(0);}

      /* Inner scrollable area (keeps header fixed) */
      .wist-p-img-section, .wist-p-gallery, .wist-p-divider, .wist-p-form,
      #wist-p-loading, #wist-p-success {
        /* These scroll naturally within the flex column */
      }
      #wist-drawer { overflow-y:auto; scrollbar-width:thin; scrollbar-color:#e4e4e7 transparent; }
      #wist-drawer::-webkit-scrollbar{width:4px;}
      #wist-drawer::-webkit-scrollbar-thumb{background:#e4e4e7;border-radius:4px;}

      /* ── Header ── */
      #wist-p-header {
        display:flex; justify-content:space-between; align-items:center;
        padding:16px 20px; border-bottom:1px solid #f4f4f5;
        flex-shrink:0; background:#fff; position:sticky; top:0; z-index:2;
      }
      .wist-p-header-left { display:flex; align-items:center; gap:10px; }
      .wist-p-brand {
        font-weight:800; font-size:16px; color:#18181b; letter-spacing:-0.03em;
        display:flex; align-items:center; gap:6px;
      }
      .wist-p-logo { flex-shrink:0; }
      .wist-p-subtitle { font-size:12px; font-weight:500; color:#a1a1aa; }
      .wist-p-close-btn {
        background:none; border:none; cursor:pointer; color:#a1a1aa;
        width:32px; height:32px; border-radius:10px;
        display:flex; align-items:center; justify-content:center;
        transition:all 0.15s;
      }
      .wist-p-close-btn:hover { color:#18181b; background:#f4f4f5; }

      /* ── Loading ── */
      .wist-p-loader { display:flex; flex-direction:column; align-items:center; gap:14px; }
      .wist-p-spinner {
        width:32px; height:32px;
        border:3px solid #f4f4f5; border-top-color:#7c3aed;
        border-radius:50%; animation:wist-spin 0.7s linear infinite;
      }
      .wist-p-loader-text { font-size:13px; color:#a1a1aa; font-weight:500; }
      @keyframes wist-spin { to { transform:rotate(360deg); } }

      /* ── Image ── */
      .wist-p-img-section { padding:20px 20px 0; text-align:center; }
      .wist-p-main-img {
        max-width:100%; max-height:240px; object-fit:contain;
        border-radius:12px; background:#fafafa;
        border:1px solid #f0f0f0;
      }

      /* ── Gallery ── */
      .wist-p-gallery {
        display:flex; gap:8px; padding:12px 20px; overflow-x:auto;
        scrollbar-width:none;
      }
      .wist-p-gallery::-webkit-scrollbar { display:none; }
      .wist-p-thumb {
        width:52px; height:52px; flex-shrink:0; border-radius:10px;
        border:2px solid #e4e4e7; object-fit:contain; background:#fafafa;
        cursor:pointer; transition:all 0.15s;
      }
      .wist-p-thumb:hover { border-color:#c4b5fd; transform:scale(1.05); }
      .wist-p-thumb.selected { border-color:#7c3aed; box-shadow:0 0 0 1.5px #7c3aed; }

      /* ── Divider ── */
      .wist-p-divider { height:1px; background:#f4f4f5; margin:0 20px; flex-shrink:0; }

      /* ── Form ── */
      .wist-p-form { padding:16px 20px 24px; display:flex; flex-direction:column; gap:14px; }
      .wist-p-field { display:flex; flex-direction:column; gap:5px; }
      .wist-p-label {
        font-size:11px; font-weight:700; color:#a1a1aa;
        text-transform:uppercase; letter-spacing:0.06em;
      }
      .wist-p-input {
        width:100%; padding:10px 12px; border:1.5px solid #e4e4e7; border-radius:10px;
        font-size:14px; color:#18181b; background:#fff; outline:none;
        transition:border-color 0.15s, box-shadow 0.15s; font-family:inherit;
      }
      .wist-p-input:focus { border-color:#7c3aed; box-shadow:0 0 0 3px rgba(124,58,237,0.08); }
      .wist-p-input::placeholder { color:#d4d4d8; }

      .wist-p-price-wrap {
        position:relative; display:flex; align-items:center;
      }
      .wist-p-price-symbol {
        position:absolute; left:12px; font-size:14px; font-weight:600;
        color:#a1a1aa; pointer-events:none;
      }
      .wist-p-input-price { padding-left:24px; }

      .wist-p-row { display:flex; gap:10px; align-items:flex-end; }

      .wist-p-chip {
        display:inline-flex; align-items:center; gap:5px;
        background:#f4f4f5; padding:9px 12px; border-radius:10px;
        font-size:12px; font-weight:600; color:#52525b; white-space:nowrap;
        border:1px solid #e4e4e7;
      }
      .wist-p-chip-store { gap:4px; }
      .wist-p-chip-store svg { flex-shrink:0; opacity:0.5; }
      .wist-p-chip-text { }

      /* ── Privacy toggle ── */
      .wist-p-privacy {
        display:flex; justify-content:space-between; align-items:center;
        padding:10px 14px; border-radius:10px; border:1.5px solid #e4e4e7;
        cursor:pointer; transition:all 0.15s; user-select:none;
      }
      .wist-p-privacy:hover { border-color:#d4d4d8; background:#fafafa; }
      .wist-p-privacy-left { display:flex; align-items:center; gap:8px; color:#71717a; }
      .wist-p-privacy-label { font-size:13px; font-weight:500; color:#52525b; }
      .wist-p-switch {
        width:38px; height:22px; background:#d4d4d8; border-radius:20px;
        position:relative; transition:background 0.2s; flex-shrink:0;
      }
      .wist-p-switch.active { background:#7c3aed; }
      .wist-p-knob {
        width:18px; height:18px; background:#fff; border-radius:50%;
        position:absolute; top:2px; left:2px; transition:transform 0.2s;
        box-shadow:0 1px 3px rgba(0,0,0,0.1);
      }
      .wist-p-switch.active .wist-p-knob { transform:translateX(16px); }

      /* ── Save button ── */
      .wist-p-save-btn {
        width:100%; border:none;
        padding:14px 16px; border-radius:12px;
        font-weight:700; font-size:15px; cursor:pointer;
        font-family:inherit; margin-top:2px; letter-spacing:-0.01em;
        display:flex; align-items:center; justify-content:center; gap:8px;
        background:linear-gradient(135deg,#7c3aed 0%,#6d28d9 100%);
        color:#fff;
        box-shadow:0 1px 3px rgba(124,58,237,0.3), inset 0 1px 0 rgba(255,255,255,0.1);
        transition:all 0.2s;
      }
      .wist-p-save-btn:hover { filter:brightness(1.08); box-shadow:0 4px 12px rgba(124,58,237,0.3), inset 0 1px 0 rgba(255,255,255,0.1); transform:translateY(-1px); }
      .wist-p-save-btn:active { transform:translateY(0); filter:brightness(0.97); }
      .wist-p-save-btn:disabled { background:#d4d4d8; color:#a1a1aa; cursor:not-allowed; box-shadow:none; transform:none; filter:none; }
      .wist-p-save-icon { flex-shrink:0; }

      /* ── Limit notice ── */
      .wist-p-limit-notice {
        margin-top:2px; margin-bottom:2px; padding:14px;
        border-radius:12px; border:1px solid #fde68a;
        background:linear-gradient(180deg,#fffbeb 0%,#ffffff 60%);
        box-shadow:0 2px 8px rgba(245,158,11,0.06);
      }
      .wist-p-limit-row { display:flex; gap:12px; align-items:flex-start; text-align:left; }
      .wist-p-limit-icon {
        flex-shrink:0; width:36px; height:36px; border-radius:10px;
        background:#fef3c7; border:1px solid #fde68a;
        display:flex; align-items:center; justify-content:center; color:#d97706;
      }
      .wist-p-limit-text { min-width:0; flex:1; }
      .wist-p-limit-title { display:block; font-size:13px; font-weight:700; color:#18181b; margin-bottom:4px; }
      .wist-p-limit-desc { margin:0; font-size:12px; line-height:1.5; color:#78716c; }
      .wist-p-upgrade-cta {
        display:flex; align-items:center; justify-content:center; gap:6px;
        width:100%; margin-top:12px; padding:10px 14px; border-radius:10px;
        background:linear-gradient(135deg,#7c3aed 0%,#6d28d9 100%);
        color:#fff !important; font-size:13px; font-weight:700; text-align:center;
        text-decoration:none; font-family:inherit; box-sizing:border-box;
        transition:all 0.2s; letter-spacing:-0.01em;
        box-shadow:0 1px 3px rgba(124,58,237,0.25);
      }
      .wist-p-upgrade-cta:hover { filter:brightness(1.08); transform:translateY(-1px); }

      /* ── Success ── */
      .wist-p-success-ring {
        width:72px; height:72px; border-radius:50%;
        background:linear-gradient(135deg,#dcfce7 0%,#bbf7d0 100%);
        display:flex; align-items:center; justify-content:center;
        box-shadow:0 0 0 8px rgba(34,197,94,0.08);
      }
      .wist-p-success-title { font-weight:800; font-size:18px; color:#18181b; margin-top:18px; letter-spacing:-0.02em; }
      .wist-p-success-sub { font-size:13px; color:#71717a; margin-top:6px; line-height:1.5; max-width:240px; }
    `;
  }
  } catch (err) {
    console.error('[Wist] Floating panel init error:', err);
  }
})();