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

    // 2. Request Preview from Background Script
    console.log("Requesting preview for:", tab.url);
    
    chrome.runtime.sendMessage(
      { action: "PREVIEW_LINK", url: tab.url },
      (response) => {
        // Chrome Runtime Error Check
        if (chrome.runtime.lastError) {
          errorMsg.textContent = "Connection failed. Reload extension.";
          console.error("Runtime Error:", chrome.runtime.lastError);
          showState('error');
          return;
        }

        // API Error Check
        if (!response || !response.success) {
          errorMsg.textContent = response?.error || "Failed to load product.";
          showState('error');
          return;
        }

        // 3. Render Preview
        const item = response.data;
        document.getElementById('item-title').textContent = item.title || 'Untitled Item';
        
        // Format price
        const priceText = item.price ? `$${item.price}` : 'Price not found';
        document.getElementById('item-price').textContent = priceText;
        
        const img = document.getElementById('item-image');
        if (item.image_url) {
          img.src = item.image_url;
          img.onerror = function() {
            this.style.display = 'none';
          };
        } else {
          img.style.display = 'none';
        }
        
        // Store data for the save button
        saveBtn.onclick = () => handleSave(item);
        
        showState('preview');
      }
    );
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
