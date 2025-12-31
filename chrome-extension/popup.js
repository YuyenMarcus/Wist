// popup.js - The Logic
// Gets current tab URL and fetches product preview from Next.js API

// API Base URL (must match background.js)
const API_BASE_URL = "https://wishlist.nuvio.cloud";

document.addEventListener('DOMContentLoaded', async () => {
  const loading = document.getElementById('loading');
  const content = document.getElementById('content');
  const errorDiv = document.getElementById('error');

  // 1. Get current active tab
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  if (!tab || !tab.url) {
    showError("No active tab found.");
    return;
  }

  // Skip if on chrome:// or extension pages
  if (tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://')) {
    showError("Please navigate to a product page.");
    return;
  }

  // 2. Show loading state
  loading.style.display = 'block';

  // 3. Ask Background script to fetch preview data from Next.js API
  chrome.runtime.sendMessage(
    { action: "PREVIEW_LINK", url: tab.url },
    (response) => {
      loading.style.display = 'none';

      if (!response || !response.success) {
        showError(response?.error || "Failed to fetch product details.");
        return;
      }

      // 4. Populate UI
      const data = response.data;
      document.getElementById('p-title').textContent = data.title || 'Untitled Item';
      
      if (data.price_string) {
        document.getElementById('p-price').textContent = data.price_string;
      } else if (data.price) {
        document.getElementById('p-price').textContent = `$${data.price}`;
      } else {
        document.getElementById('p-price').textContent = 'Price not found';
        document.getElementById('p-price').style.color = '#6b7280';
      }

      if (data.image_url) {
        document.getElementById('p-image').src = data.image_url;
        document.getElementById('p-image').onerror = function() {
          this.style.display = 'none';
        };
      } else {
        document.getElementById('p-image').style.display = 'none';
      }

      content.style.display = 'block';

      // Store data for the save button
      const saveBtn = document.getElementById('save-btn');
      let isSaving = false;

      saveBtn.onclick = async () => {
        // Prevent double-clicks
        if (isSaving) return;
        isSaving = true;

        // UI Feedback: Disable button and show loading state
        saveBtn.disabled = true;
        saveBtn.textContent = 'Saving...';
        saveBtn.style.opacity = '0.7';

        // Package the product data
        const itemData = {
          title: data.title || 'Untitled Item',
          price: data.price || null,
          url: data.url || tab.url,
          image_url: data.image_url || null,
          retailer: data.retailer || 'Unknown',
        };

        // Send message to background script to save item
        chrome.runtime.sendMessage(
          { action: "SAVE_ITEM", data: itemData },
          (response) => {
            isSaving = false;

            if (!response) {
              // No response - likely connection error
              saveBtn.disabled = false;
              saveBtn.textContent = 'Save to Wishlist';
              saveBtn.style.opacity = '1';
              showError("No response from Wist. Please try again.");
              return;
            }

            if (response.success) {
              // Success: Show success state
              saveBtn.textContent = 'Saved! ✓';
              saveBtn.style.backgroundColor = '#10b981'; // Green
              saveBtn.style.opacity = '1';
              
              // Close popup after 1.5 seconds
              setTimeout(() => {
                window.close();
              }, 1500);
            } else {
              // Error: Show error state
              saveBtn.disabled = false;
              saveBtn.textContent = 'Try Again';
              saveBtn.style.backgroundColor = '#ef4444'; // Red
              saveBtn.style.opacity = '1';
              
              // Show error message
              const errorMsg = response.error || "Failed to save item";
              showError(errorMsg);

              // If auth required, show login message
              if (response.requiresAuth) {
                setTimeout(() => {
                  if (confirm("You need to log in to Wist first. Open Wist in a new tab?")) {
                    chrome.tabs.create({ url: `${API_BASE_URL}/login` });
                  }
                }, 500);
              }

              // Reset button after 3 seconds
              setTimeout(() => {
                saveBtn.textContent = 'Save to Wishlist';
                saveBtn.style.backgroundColor = '#6366f1'; // Original color
                saveBtn.style.opacity = '1';
              }, 3000);
            }
          }
        );
      };
    }
  );
});

function showError(msg) {
  const errorDiv = document.getElementById('error');
  document.getElementById('loading').style.display = 'none';
  errorDiv.textContent = msg;
  errorDiv.style.display = 'block';
}
