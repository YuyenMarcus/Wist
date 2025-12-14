// content.js - The Scraper & UI Injector
// Handles DOM interaction and injects the purchase celebration modal

(function() {
  'use strict';

  // Check if we're already initialized to avoid double injection
  if (window.wistContentScriptLoaded) {
    return;
  }
  window.wistContentScriptLoaded = true;

  // Listen for messages from background script
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "TRIGGER_PURCHASE_POPUP") {
      injectPurchaseModal(request.url);
      sendResponse({ success: true });
    }
    return true;
  });

  function injectPurchaseModal(url) {
    // 1. Check if modal already exists to avoid duplicates
    if (document.getElementById('wist-purchase-modal')) {
      return;
    }

    // 2. Create container with Shadow DOM (isolates our CSS)
    const container = document.createElement('div');
    container.id = 'wist-purchase-modal';
    const shadow = container.attachShadow({ mode: 'open' });

    // 3. Inject styles and HTML
    shadow.innerHTML = `
      <style>
        @import url('${chrome.runtime.getURL('styles.css')}');
        
        .wist-card {
          position: fixed;
          bottom: 20px;
          right: 20px;
          width: 360px;
          background: white;
          border-radius: 16px;
          box-shadow: 0 20px 60px rgba(0,0,0,0.2);
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
          z-index: 2147483647;
          overflow: hidden;
          animation: wistSlideIn 0.4s cubic-bezier(0.16, 1, 0.3, 1);
        }
        
        .wist-header {
          background: linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%);
          color: white;
          padding: 20px;
          font-weight: 600;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }
        
        .wist-header-title {
          display: flex;
          align-items: center;
          gap: 10px;
          font-size: 18px;
        }
        
        .wist-close {
          cursor: pointer;
          opacity: 0.9;
          font-size: 20px;
          line-height: 1;
          transition: opacity 0.2s;
        }
        
        .wist-close:hover {
          opacity: 1;
        }
        
        .wist-body {
          padding: 24px;
        }
        
        .wist-body p {
          margin: 0 0 20px 0;
          color: #4b5563;
          font-size: 14px;
          line-height: 1.6;
        }
        
        .wist-btn {
          background: #111827;
          color: white;
          border: none;
          padding: 12px 24px;
          border-radius: 8px;
          cursor: pointer;
          width: 100%;
          font-weight: 600;
          font-size: 14px;
          transition: all 0.2s;
          margin-bottom: 10px;
        }
        
        .wist-btn:hover {
          background: #1f2937;
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        }
        
        .wist-btn:active {
          transform: translateY(0);
        }
        
        .wist-btn-secondary {
          background: transparent;
          color: #6b7280;
          border: none;
          padding: 8px;
          cursor: pointer;
          font-size: 13px;
          width: 100%;
        }
        
        .wist-btn-secondary:hover {
          color: #111827;
        }
        
        .wist-loading {
          opacity: 0.6;
          pointer-events: none;
        }
        
        @keyframes wistSlideIn {
          from {
            transform: translateY(100px);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }
      </style>
      
      <div class="wist-card">
        <div class="wist-header">
          <div class="wist-header-title">
            <span>🎉</span>
            <span>Nice haul!</span>
          </div>
          <span class="wist-close" id="wist-close-btn">×</span>
        </div>
        <div class="wist-body">
          <p>
            Do you want to post this purchase to your <strong>Wist Feed</strong>?
          </p>
          <button class="wist-btn" id="wist-post-btn">
            Post to "Just Got It"
          </button>
          <button class="wist-btn-secondary" id="wist-wishlist-btn">
            Add to Wishlist instead
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(container);

    // 4. Add event listeners
    const closeBtn = shadow.getElementById('wist-close-btn');
    const postBtn = shadow.getElementById('wist-post-btn');
    const wishlistBtn = shadow.getElementById('wist-wishlist-btn');

    closeBtn.addEventListener('click', () => {
      container.remove();
    });

    postBtn.addEventListener('click', async () => {
      await handlePostToWist(url, postBtn, shadow);
    });

    wishlistBtn.addEventListener('click', async () => {
      await handleAddToWishlist(url, wishlistBtn, shadow);
    });

    // Auto-close after 30 seconds if no interaction
    setTimeout(() => {
      if (document.getElementById('wist-purchase-modal')) {
        container.remove();
      }
    }, 30000);
  }

  async function handlePostToWist(url, btn, shadow) {
    btn.classList.add('wist-loading');
    btn.textContent = "Posting...";

    try {
      // Get auth token from storage
      const { wist_auth_token } = await chrome.storage.local.get(['wist_auth_token']);
      
      if (!wist_auth_token) {
        // Redirect to login or open popup
        chrome.runtime.sendMessage({ action: 'OPEN_POPUP' });
        btn.textContent = "Please log in first";
        setTimeout(() => {
          document.getElementById('wist-purchase-modal')?.remove();
        }, 2000);
        return;
      }

      // Extract purchase data from page
      const purchaseData = await extractPurchaseData(url);

      // Send to Supabase via Wist API
      const response = await fetch('https://wishlist.nuvio.cloud/api/purchases', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${wist_auth_token}`
        },
        body: JSON.stringify({
          url: url,
          ...purchaseData,
          type: 'just_got_it'
        })
      });

      if (!response.ok) {
        throw new Error('Failed to post purchase');
      }

      // Success feedback
      btn.textContent = "Posted! 🚀";
      btn.style.backgroundColor = "#10b981";
      
      setTimeout(() => {
        document.getElementById('wist-purchase-modal')?.remove();
      }, 2000);

    } catch (error) {
      console.error('Error posting to Wist:', error);
      btn.textContent = "Error - Try again";
      btn.style.backgroundColor = "#ef4444";
      setTimeout(() => {
        btn.textContent = "Post to \"Just Got It\"";
        btn.style.backgroundColor = "#111827";
        btn.classList.remove('wist-loading');
      }, 2000);
    }
  }

  async function handleAddToWishlist(url, btn, shadow) {
    btn.textContent = "Opening Wist...";
    
    // Open Wist in new tab with the URL pre-filled
    chrome.runtime.sendMessage({
      action: 'OPEN_WISHLIST',
      url: url
    });

    document.getElementById('wist-purchase-modal')?.remove();
  }

  async function extractPurchaseData(url) {
    // Try to extract product information from the page
    // This is a basic implementation - you can enhance it per retailer
    
    const data = {
      url: url,
      title: null,
      price: null,
      image: null,
    };

    // Amazon-specific extraction
    if (url.includes('amazon.com')) {
      const titleEl = document.querySelector('#order-confirmation h1, .a-text-center h1');
      const priceEl = document.querySelector('.a-color-price');
      
      if (titleEl) data.title = titleEl.textContent.trim();
      if (priceEl) data.price = priceEl.textContent.trim();
    }

    // Target-specific extraction
    if (url.includes('target.com')) {
      const titleEl = document.querySelector('[data-test="order-item-name"]');
      const priceEl = document.querySelector('[data-test="order-price"]');
      
      if (titleEl) data.title = titleEl.textContent.trim();
      if (priceEl) data.price = priceEl.textContent.trim();
    }

    // Generic fallback - try to find any product title
    if (!data.title) {
      const titleEl = document.querySelector('h1, [class*="title"], [class*="product"]');
      if (titleEl) data.title = titleEl.textContent.trim();
    }

    return data;
  }
})();

