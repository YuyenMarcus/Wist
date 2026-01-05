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
      console.log("✅ [ExtensionSync] Session found, token length:", token.length);
      console.log("🔑 [ExtensionSync] Token preview:", token.substring(0, 20) + "...");
      console.log("👤 [ExtensionSync] User:", session.user.email);
      
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
              console.log("⚠️ [ExtensionSync] Extension not installed or not listening:", chrome.runtime.lastError.message);
              setMsg("Extension Not Found");
              setColor("bg-yellow-600");
            } else {
              console.log("✅ [ExtensionSync] Token sent to extension:", response);
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
      
      console.log("📡 [ExtensionSync] Token broadcast via postMessage");
      
    } catch (error: any) {
      console.error("❌ [ExtensionSync] Error:", error);
      setMsg("Sync Error");
      setColor("bg-red-600");
    }
  };

  // Run automatically on mount
  useEffect(() => {
    syncTokenToExtension();
    
    // Sync every 30 seconds to catch token refreshes
    const interval = setInterval(syncTokenToExtension, 30000);
    
    return () => {
      console.log("🔴 [ExtensionSync] Component unmounting");
      clearInterval(interval);
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
