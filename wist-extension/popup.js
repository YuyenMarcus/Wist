document.addEventListener('DOMContentLoaded', async () => {
  // UI Elements
  const loadingDiv = document.getElementById('loading');
  const previewDiv = document.getElementById('preview');
  const errorDiv = document.getElementById('error');
  const errorMsg = document.getElementById('error-msg');
  const saveBtn = document.getElementById('save-btn');

  // Safety check - ensure all elements exist
  if (!loadingDiv || !previewDiv || !errorDiv || !errorMsg || !saveBtn) {
    console.error('Missing required UI elements');
    return;
  }

  // Helper to show states
  function showState(state) {
    loadingDiv.classList.add('hidden');
    previewDiv.classList.add('hidden');
    errorDiv.classList.add('hidden');
    
    if (state === 'loading') loadingDiv.classList.remove('hidden');
    if (state === 'preview') previewDiv.classList.remove('hidden');
    if (state === 'error') errorDiv.classList.remove('hidden');
  }

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

    // 2. Client-Side Scraping (Bypasses Amazon Bot Detection)
    // Instead of asking the server (which gets blocked), we inject a script
    // into the current page to grab the data directly from the DOM
    console.log("Scraping page directly:", tab.url);
    
    try {
      const results = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => {
          // This runs INSIDE the Amazon/product page
          const title = document.getElementById('productTitle')?.innerText.trim() 
                     || document.querySelector('h1')?.innerText.trim()
                     || document.title.replace('Amazon.com: ', '').replace(' : Amazon.com', '');
          
          // Amazon Price Selectors (try multiple)
          let price = document.querySelector('.a-price .a-offscreen')?.innerText 
                   || document.querySelector('#priceblock_ourprice')?.innerText 
                   || document.querySelector('#priceblock_dealprice')?.innerText
                   || document.querySelector('.a-color-price')?.innerText
                   || "0.00";
          
          // Clean price (remove currency symbols, keep numbers and decimal)
          const cleanPrice = price.replace(/[^0-9.]/g, '');
          const priceValue = parseFloat(cleanPrice) || 0;
          
          const image = document.getElementById('landingImage')?.src 
                     || document.querySelector('#imgBlkFront')?.src
                     || document.querySelector('.a-dynamic-image')?.src
                     || '';

          // Extract retailer from URL
          const urlObj = new URL(window.location.href);
          const retailer = urlObj.hostname.replace('www.', '').split('.')[0];

          return { 
            title, 
            price: priceValue,
            price_string: price, // Keep original for display
            image_url: image, 
            url: window.location.href,
            retailer: retailer.charAt(0).toUpperCase() + retailer.slice(1)
          };
        }
      });

      const data = results[0].result;
      
      // 3. Render Preview
      document.getElementById('item-title').textContent = data.title || 'Untitled Item';
      
      // Format price for display
      const priceText = data.price_string && data.price_string !== '0.00' 
        ? data.price_string 
        : (data.price > 0 ? `$${data.price.toFixed(2)}` : 'Price not found');
      document.getElementById('item-price').textContent = priceText;
      
      const img = document.getElementById('item-image');
      if (data.image_url) {
        img.src = data.image_url;
        img.onerror = function() {
          this.style.display = 'none';
        };
      } else {
        img.style.display = 'none';
      }
      
      // Store data for the save button
      saveBtn.onclick = () => handleSave(data);
      
      showState('preview');

    } catch (err) {
      // Fallback to server if injection fails (e.g., restricted page)
      console.error("Client scrape failed, using server fallback", err);
      errorMsg.textContent = "Could not access page. Try a different page.";
      showState('error');
      
      // Optional: Could fall back to server here if needed
      // But Amazon blocks server scraping anyway, so better to show error
    }
  } catch (error) {
    console.error("Popup Error:", error);
    errorMsg.textContent = `Error: ${error.message}`;
    showState('error');
  }

  // 4. Save Handler
  async function handleSave(item) {
    saveBtn.textContent = "Saving...";
    saveBtn.disabled = true;

    chrome.runtime.sendMessage(
      { action: "SAVE_ITEM", data: item },
      (response) => {
        // Check for Chrome runtime errors
        if (chrome.runtime.lastError) {
          saveBtn.textContent = "Connection Error";
          saveBtn.style.backgroundColor = "#EF4444";
          console.error("Runtime Error:", chrome.runtime.lastError);
          setTimeout(() => {
            saveBtn.textContent = "Save to Wishlist";
            saveBtn.disabled = false;
            saveBtn.style.backgroundColor = "";
          }, 2000);
          return;
        }

        if (response && response.success) {
          saveBtn.textContent = "Saved!";
          saveBtn.style.backgroundColor = "#10B981"; // Green
          setTimeout(() => window.close(), 1500);
        } else {
          saveBtn.textContent = "Error - Try Login";
          saveBtn.style.backgroundColor = "#EF4444"; // Red
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
            saveBtn.textContent = "Save to Wishlist";
            saveBtn.disabled = false;
            saveBtn.style.backgroundColor = ""; 
          }, 2000);
        }
      }
    );
  }
});
