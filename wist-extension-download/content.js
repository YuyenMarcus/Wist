// content.js

// 0. Announce extension presence immediately (before anything else)
// This allows the React app to detect if the extension is installed
document.documentElement.setAttribute('data-wist-installed', 'true');

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