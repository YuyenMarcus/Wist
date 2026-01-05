// Add this to your extension's popup or create a diagnostic page
// This will help us see EXACTLY what's wrong with the token

async function diagnoseToken() {
  console.log("🔬 [Diagnostic] Starting token diagnosis...");
  console.log("─".repeat(60));
  
  // Step 1: Check storage
  const stored = await chrome.storage.local.get(['supabase_token', 'supabase_session', 'wist_auth_token', 'last_sync']);
  
  console.log("📦 [Diagnostic] Storage contents:");
  console.log("  - supabase_token exists:", !!stored.supabase_token);
  console.log("  - supabase_session exists:", !!stored.supabase_session);
  console.log("  - wist_auth_token exists:", !!stored.wist_auth_token);
  console.log("  - last_sync:", stored.last_sync ? new Date(stored.last_sync).toLocaleString() : "Never");
  
  if (!stored.supabase_token && !stored.supabase_session && !stored.wist_auth_token) {
    console.error("❌ [Diagnostic] NO TOKEN FOUND IN STORAGE!");
    console.log("📋 [Diagnostic] Available keys:", Object.keys(stored));
    return;
  }
  
  // Step 2: Extract token
  let token = null;
  let tokenSource = null;
  
  if (stored.supabase_token) {
    token = stored.supabase_token;
    tokenSource = "supabase_token";
  } else if (stored.supabase_session) {
    const session = typeof stored.supabase_session === 'string' 
      ? JSON.parse(stored.supabase_session) 
      : stored.supabase_session;
    token = session.access_token || session.token;
    tokenSource = "supabase_session";
  } else if (stored.wist_auth_token) {
    token = stored.wist_auth_token;
    tokenSource = "wist_auth_token (legacy)";
  }
  
  console.log("─".repeat(60));
  console.log("🔑 [Diagnostic] Token info:");
  console.log("  - Source:", tokenSource);
  console.log("  - Length:", token?.length);
  console.log("  - First 30 chars:", token?.substring(0, 30));
  console.log("  - Last 10 chars:", token?.substring(token.length - 10));
  
  // Step 3: Decode JWT to check expiration
  try {
    const parts = token.split('.');
    if (parts.length === 3) {
      const payload = JSON.parse(atob(parts[1]));
      const now = Math.floor(Date.now() / 1000);
      const expiresAt = payload.exp;
      const issuedAt = payload.iat;
      
      console.log("─".repeat(60));
      console.log("📅 [Diagnostic] Token timestamps:");
      console.log("  - Issued at:", new Date(issuedAt * 1000).toLocaleString());
      console.log("  - Expires at:", new Date(expiresAt * 1000).toLocaleString());
      console.log("  - Current time:", new Date(now * 1000).toLocaleString());
      console.log("  - Time until expiry:", Math.floor((expiresAt - now) / 60), "minutes");
      
      if (expiresAt < now) {
        console.error("❌ [Diagnostic] TOKEN IS EXPIRED!");
        console.log("💡 [Diagnostic] Solution: Log out and log back in on the website");
        return;
      } else {
        console.log("✅ [Diagnostic] Token is NOT expired");
      }
      
      console.log("─".repeat(60));
      console.log("👤 [Diagnostic] Token payload:");
      console.log("  - User ID:", payload.sub);
      console.log("  - Email:", payload.email);
      console.log("  - Role:", payload.role);
    }
  } catch (e) {
    console.error("⚠️ [Diagnostic] Could not decode token:", e.message);
  }
  
  // Step 4: Test the API with this token
  console.log("─".repeat(60));
  console.log("🧪 [Diagnostic] Testing API call...");
  
  try {
    const response = await fetch('https://wishlist.nuvio.cloud/api/items', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        url: 'https://test.com',
        title: 'Diagnostic Test Item',
        price: 0,
        image_url: '',
        retailer: 'Test',
        note: 'Diagnostic test - delete me'
      })
    });
    
    console.log("📡 [Diagnostic] Response status:", response.status);
    
    const result = await response.json();
    console.log("📥 [Diagnostic] Response body:", result);
    
    if (response.status === 401) {
      console.error("❌ [Diagnostic] 401 UNAUTHORIZED - Token is being rejected by server");
      console.log("─".repeat(60));
      console.log("🔍 [Diagnostic] Possible causes:");
      console.log("  1. Token is from wrong Supabase project");
      console.log("  2. Token format is incorrect");
      console.log("  3. Server environment variables are wrong");
      console.log("  4. Token was revoked/invalidated");
    } else if (response.ok) {
      console.log("✅ [Diagnostic] API CALL SUCCESSFUL!");
      console.log("💡 [Diagnostic] The token works! Check your actual save function for bugs.");
    }
    
  } catch (e) {
    console.error("❌ [Diagnostic] API call failed:", e);
  }
  
  console.log("─".repeat(60));
  console.log("🏁 [Diagnostic] Diagnosis complete");
}

// Run the diagnostic
diagnoseToken();

