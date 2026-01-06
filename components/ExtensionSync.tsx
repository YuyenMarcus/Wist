'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';

// ⚠️ CONFIRM THIS ID MATCHES YOUR CHROME://EXTENSIONS
const EXTENSION_ID = "hlgalligngcfiaibgkinhlkaniibjlmh"; 

export default function ExtensionSync() {
  const [msg, setMsg] = useState("Initializing...");
  const [color, setColor] = useState("bg-gray-800");

  const syncTokenToExtension = async () => {
    try {
      setMsg("Syncing...");
      setColor("bg-yellow-600");

      console.log("🔵 [ExtensionSync] Component mounted");
      console.log("🔵 [ExtensionSync] Syncing token...");
      
      // Get current session
      const { data: { session }, error } = await supabase.auth.getSession();
      
      if (error) {
        console.error("❌ [ExtensionSync] Session error:", error);
        setMsg("Session Error");
        setColor("bg-red-600");
        return;
      }
      
      if (!session) {
        console.log("⚠️ [ExtensionSync] No active session");
        setMsg("No Session");
        setColor("bg-yellow-600");
        return;
      }
      
      const token = session.access_token;
      console.log("✅ [ExtensionSync] Fresh token obtained, length:", token.length);
      console.log("👤 [ExtensionSync] User:", session.user.email);
      
      // Decode token to check expiration
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        const expiresAt = new Date(payload.exp * 1000);
        const now = new Date();
        const minutesUntilExpiry = Math.floor((expiresAt.getTime() - now.getTime()) / 60000);
        
        console.log("⏰ [ExtensionSync] Token expires in:", minutesUntilExpiry, "minutes");
      } catch (e) {
        console.warn("⚠️ [ExtensionSync] Could not decode token expiry");
      }
      
      // Check if Chrome API exists
      if (typeof window === 'undefined' || !(window as any).chrome || !(window as any).chrome.runtime) {
        setMsg("Not Chrome?");
        setColor("bg-red-600");
        return;
      }

            const chrome = (window as any).chrome;

      // Method 1: Direct chrome.runtime message (if extension is installed)
      try {
            chrome.runtime.sendMessage(
              EXTENSION_ID,
          {
            type: 'AUTH_TOKEN',
            token: token,
            session: session,
            timestamp: Date.now()
          },
              (response: any) => {
            if (chrome.runtime.lastError) {
              console.log("⚠️ [ExtensionSync] Extension not responding:", chrome.runtime.lastError.message);
              setMsg("Extension Not Found");
              setColor("bg-yellow-600");
            } else {
              console.log("✅ [ExtensionSync] Token synced to extension:", response);
              setMsg("Synced Successfully!");
              setColor("bg-green-600");
              // Hide after 3 seconds on success
              setTimeout(() => {
                setColor("hidden");
                setMsg("");
              }, 3000);
                }
              }
            );
        } catch (e) {
        console.log("⚠️ [ExtensionSync] Could not send via chrome.runtime:", e);
        setMsg("Send Error");
        setColor("bg-red-600");
      }
      
      // Method 2: postMessage (backup method)
      window.postMessage({
        type: 'WIST_AUTH_TOKEN',
        token: token,
        session: session,
        timestamp: Date.now()
      }, '*');
      
      console.log("📡 [ExtensionSync] Token broadcast complete");
      
    } catch (error: any) {
      console.error("❌ [ExtensionSync] Error:", error);
      setMsg("Sync Error");
      setColor("bg-red-600");
      }
    };

  // Run automatically on mount
  useEffect(() => {
    console.log("🔵 [ExtensionSync] Component mounted");
    
    // Sync immediately on mount
    syncTokenToExtension();
    
    // Sync every 10 minutes (tokens expire after 60 minutes)
    // This ensures the extension always has a fresh token
    const interval = setInterval(() => {
      console.log("🔄 [ExtensionSync] Auto-refresh triggered");
      syncTokenToExtension();
    }, 10 * 60 * 1000); // 10 minutes
    
    // Listen for auth state changes (login/logout/token refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log("🔔 [ExtensionSync] Auth state changed:", event);
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        console.log("🔄 [ExtensionSync] Syncing due to auth change");
        syncTokenToExtension();
      }
    });

    return () => {
      console.log("🔴 [ExtensionSync] Component unmounting");
      clearInterval(interval);
      subscription.unsubscribe();
    };
  }, []);

  // RENDER A VISIBLE DEBUG BUTTON
  return (
    <div 
      onClick={syncTokenToExtension}
      className={`fixed bottom-4 right-4 ${color} text-white px-4 py-2 rounded shadow-lg cursor-pointer z-[9999] text-xs font-mono transition-all`}
    >
      [Wist Sync] {msg}
    </div>
  );
}
