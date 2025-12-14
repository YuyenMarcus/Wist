// popup.js - Handles the extension popup UI

document.addEventListener('DOMContentLoaded', async () => {
  const statusEl = document.getElementById('status');
  const loginBtn = document.getElementById('login-btn');
  const dashboardBtn = document.getElementById('open-dashboard-btn');

  // Check if user is logged in
  const { wist_auth_token, wist_user_email } = await chrome.storage.local.get(['wist_auth_token', 'wist_user_email']);

  if (wist_auth_token) {
    statusEl.textContent = `Logged in as ${wist_user_email || 'user'}`;
    statusEl.className = 'status logged-in';
    loginBtn.textContent = 'Log out';
    dashboardBtn.style.display = 'block';
  } else {
    statusEl.textContent = 'Not logged in';
    statusEl.className = 'status logged-out';
    loginBtn.textContent = 'Log in to Wist';
    dashboardBtn.style.display = 'none';
  }

  loginBtn.addEventListener('click', async () => {
    if (wist_auth_token) {
      // Log out
      await chrome.storage.local.remove(['wist_auth_token', 'wist_user_email']);
      location.reload();
    } else {
      // Open login page
      chrome.tabs.create({ url: 'https://wishlist.nuvio.cloud/login?extension=true' });
    }
  });

  dashboardBtn.addEventListener('click', () => {
    chrome.tabs.create({ url: 'https://wishlist.nuvio.cloud/dashboard' });
  });
});

