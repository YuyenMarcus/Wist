document.addEventListener('DOMContentLoaded', async () => {
  const loading = document.getElementById('loading');
  const content = document.getElementById('content');
  const saveBtn = document.getElementById('save-btn');
  const errorDiv = document.getElementById('error');

  // Safety check
  if (!loading || !content || !saveBtn) {
    console.error('Missing required elements in popup.html');
    return;
  }

  // 1. Get current active tab
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  
  if (!tab || !tab.url) {
    showError("No active tab found.");
    return;
  }

  // 2. Show loading
  loading.style.display = 'block';

  // 3. Get Preview
  chrome.runtime.sendMessage(
    { action: "PREVIEW_LINK", url: tab.url },
    (response) => {
      if (loading) loading.style.display = 'none';

      // Check for Chrome extension errors
      if (chrome.runtime.lastError) {
        showError(chrome.runtime.lastError.message || "Extension error occurred.");
        return;
      }

      if (!response || !response.success) {
        showError(response?.error || "Failed to fetch product details.");
        return;
      }

      const data = response.data;
      
      // Populate UI
      const titleEl = document.getElementById('p-title');
      const priceEl = document.getElementById('p-price');
      const imageEl = document.getElementById('p-image');
      
      if (titleEl) titleEl.textContent = data.title || 'Untitled Item';
      if (priceEl) priceEl.textContent = data.price ? `$${data.price}` : 'Price not found';
      if (imageEl && data.image_url) {
        imageEl.src = data.image_url;
        imageEl.onerror = function() {
          this.style.display = 'none';
        };
      }
      if (content) content.style.display = 'block';

      // 4. Handle Save Click
      saveBtn.onclick = async () => {
        saveBtn.disabled = true;
        saveBtn.textContent = "Checking Auth...";

        // Retrieve token from storage (Saved by ExtensionSync.tsx)
        chrome.storage.local.get(['wist_auth_token'], async (result) => {
          const token = result.wist_auth_token;

          if (!token) {
            saveBtn.disabled = false;
            saveBtn.textContent = "Save to Wishlist";
            showError("Please log in to Wist first.");
            
            // Helpful: Open Wist website for login
            chrome.tabs.create({ url: 'https://wishlist.nuvio.cloud/login' });
            return;
          }

          saveBtn.textContent = "Saving...";

          // Send save request to background script (bypasses CORS)
          chrome.runtime.sendMessage(
            { 
              action: "SAVE_ITEM", 
              data: {
                url: data.url,
                title: data.title,
                price: data.price,
                image_url: data.image_url,
                retailer: data.retailer,
                description: data.description
              }
            },
            (saveResponse) => {
              if (chrome.runtime.lastError) {
                showError(chrome.runtime.lastError.message || "Extension error occurred.");
                saveBtn.disabled = false;
                saveBtn.textContent = "Save to Wishlist";
                return;
              }

              if (saveResponse && saveResponse.success) {
                saveBtn.style.background = "#10b981";
                saveBtn.textContent = "Saved!";
                setTimeout(() => window.close(), 1500);
              } else {
                showError(saveResponse?.error || "Failed to save item.");
                saveBtn.disabled = false;
                saveBtn.textContent = "Save to Wishlist";
              }
            }
          );

            const result = await saveResponse.json();

            if (saveResponse.ok && result.success) {
              saveBtn.style.background = "#10b981";
              saveBtn.textContent = "Saved!";
              setTimeout(() => window.close(), 1500);
            } else {
              showError(result.error || "Server error.");
              saveBtn.disabled = false;
              saveBtn.textContent = "Save to Wishlist";
            }
          } catch (err) {
            console.error(err);
            showError("Network error. Is server running?");
            saveBtn.disabled = false;
            saveBtn.textContent = "Save to Wishlist";
          }
        });
      };
    }
  );
});


function showError(msg) {
  const errorDiv = document.getElementById('error');
  const loading = document.getElementById('loading');
  
  if (loading) {
    loading.style.display = 'none';
  }
  
  if (errorDiv) {
    errorDiv.textContent = msg;
    errorDiv.style.display = 'block';
  } else {
    console.error('Error:', msg);
    alert(msg); // Fallback if error div doesn't exist
  }
}
