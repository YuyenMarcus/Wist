// detect.js
// This script runs on wishlist.nuvio.cloud to announce extension presence
// It adds a class to the HTML element that the website can detect

// Run immediately, even before DOM is ready
if (document.documentElement) {
  document.documentElement.classList.add('has-extension');
  // Also set a global variable for easy JavaScript access
  window.HAS_MY_EXTENSION = true;
} else {
  // Fallback: wait for DOM if documentElement isn't ready yet
  document.addEventListener('DOMContentLoaded', () => {
    document.documentElement.classList.add('has-extension');
    window.HAS_MY_EXTENSION = true;
  });
}
