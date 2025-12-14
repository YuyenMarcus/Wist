// popup.js - The Logic
// Gets current tab URL and fetches product preview from Next.js API

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
      document.getElementById('save-btn').onclick = async () => {
        // TODO: This is where we will call the "Save Item" API in the next step
        const btn = document.getElementById('save-btn');
        btn.disabled = true;
        btn.textContent = 'Saving...';
        
        // Temporary alert - will be replaced with actual API call
        setTimeout(() => {
          alert(`Saving "${data.title}" to Wist...`);
          btn.disabled = false;
          btn.textContent = 'Save to Wishlist';
        }, 500);
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
