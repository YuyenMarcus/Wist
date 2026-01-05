// EMERGENCY MANUAL TOKEN SYNC
// Paste this in your browser console at wishlist.nuvio.cloud

(async function manualSync() {
  try {
    console.log("🔧 [Manual Sync] Starting emergency token sync...");
    
    // Get the Supabase session from localStorage
    const storageKey = Object.keys(localStorage).find(key => 
      key.includes('supabase.auth.token') || key.includes('auth-token')
    );
    
    if (!storageKey) {
      console.error("❌ No auth token in localStorage. Are you logged in?");
      console.log("Available keys:", Object.keys(localStorage));
      return;
    }
    
    const authData = localStorage.getItem(storageKey);
    const session = JSON.parse(authData);
    const token = session.access_token || session.currentSession?.access_token;
    
    if (!token) {
      console.error("❌ Could not extract token from session");
      return;
    }
    
    console.log("✅ Token found, length:", token.length);
    
    // Check token expiry
    const payload = JSON.parse(atob(token.split('.')[1]));
    const expiresAt = new Date(payload.exp * 1000);
    const now = new Date();
    const minutesUntilExpiry = Math.floor((expiresAt.getTime() - now.getTime()) / 60000);
    
    console.log("⏰ Token expires in:", minutesUntilExpiry, "minutes");
    console.log("👤 User:", payload.email);
    
    if (minutesUntilExpiry < 0) {
      console.error("❌ This token is EXPIRED! Please log out and log back in.");
      return;
    }
    
    // Send to extension
    const extensionId = 'hlgalligngcfiaibgkinhlkaniibjlmh';
    
    console.log("📡 Sending to extension...");
    
    chrome.runtime.sendMessage(
      extensionId,
      {
        type: 'AUTH_TOKEN',
        token: token,
        session: session,
        timestamp: Date.now()
      },
      (response) => {
        if (chrome.runtime.lastError) {
          console.error("❌ Extension error:", chrome.runtime.lastError.message);
        } else {
          console.log("✅ SUCCESS! Token synced to extension:", response);
          console.log("🎉 You can now try saving an item!");
        }
      }
    );
    
  } catch (error) {
    console.error("❌ Manual sync failed:", error);
  }
})();

