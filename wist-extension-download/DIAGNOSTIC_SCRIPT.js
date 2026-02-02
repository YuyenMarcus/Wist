// ============================================================================
// WIST EXTENSION CONNECTION DIAGNOSTIC SCRIPT
// ============================================================================
// Paste this into your Dashboard Browser Console (F12) to diagnose issues
// ============================================================================

(async function diagnoseExtensionConnection() {
  console.log("═══════════════════════════════════════════════════════════");
  console.log("🔍 WIST EXTENSION CONNECTION DIAGNOSTICS");
  console.log("═══════════════════════════════════════════════════════════");
  
  const EXTENSION_ID = "hlgalligngcfiaibgkinhlkaniibjlmh"; // ✅ Current ID
  
  // Test 1: Check Chrome Extension API
  console.log("\n1️⃣ Checking Chrome Extension API...");
  if (typeof chrome === 'undefined' || !chrome.runtime) {
    console.error("❌ Chrome Extension API not available!");
    console.error("   Are you using Chrome browser?");
    return;
  }
  console.log("✅ Chrome Extension API available");
  
  // Test 2: Check Extension ID
  console.log("\n2️⃣ Checking Extension ID...");
  console.log("   Extension ID:", EXTENSION_ID);
  
  // Test 3: Get Auth Token
  console.log("\n3️⃣ Getting Auth Token from localStorage...");
  const storageKeys = Object.keys(localStorage).filter(k => k.includes('auth-token'));
  if (storageKeys.length === 0) {
    console.error("❌ No auth token found in localStorage!");
    console.error("   Are you logged in?");
    return;
  }
  
  const rawData = localStorage.getItem(storageKeys[0]);
  const session = JSON.parse(rawData);
  const token = session?.access_token || session?.currentSession?.access_token;
  
  if (!token) {
    console.error("❌ Could not extract token from session!");
    return;
  }
  console.log("✅ Token found:", token.substring(0, 20) + "...");
  
  // Test 4: Try to send message
  console.log("\n4️⃣ Attempting to send message to extension...");
  console.log("   Message:", { action: "SYNC_TOKEN", token: token.substring(0, 20) + "..." });
  
  chrome.runtime.sendMessage(
    EXTENSION_ID,
    { action: "SYNC_TOKEN", token: token },
    (response) => {
      console.log("\n5️⃣ Response received:");
      
      if (chrome.runtime.lastError) {
        console.error("❌ CHROME ERROR:", chrome.runtime.lastError.message);
        console.error("\n💡 Possible causes:");
        console.error("   1. Extension not installed");
        console.error("   2. Extension ID is wrong");
        console.error("   3. Extension not reloaded after manifest change");
        console.error("   4. manifest.json 'externally_connectable' missing/wrong");
        console.error("\n🔧 Fix:");
        console.error("   1. Go to chrome://extensions/");
        console.error("   2. Find Wist extension");
        console.error("   3. Copy the Extension ID");
        console.error("   4. Update EXTENSION_ID in this script");
        console.error("   5. Reload the extension");
        console.error("   6. Run this script again");
      } else if (response?.success) {
        console.log("✅ SUCCESS! Extension received the token!");
        console.log("   Response:", response);
        console.log("\n✅ Next step:");
        console.log("   Check Service Worker console to verify token in storage:");
        console.log("   chrome.storage.local.get(null, console.log)");
      } else {
        console.warn("⚠️ Unexpected response:", response);
      }
      
      console.log("\n═══════════════════════════════════════════════════════════");
    }
  );
})();

