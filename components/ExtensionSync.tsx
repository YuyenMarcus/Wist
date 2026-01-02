'use client';

import { useEffect } from 'react';
import { supabase } from '@/lib/supabase/client';

// ⚠️ IMPORTANT: Extension ID changes when you reload the extension!
// To get your current Extension ID:
// 1. Go to chrome://extensions/
// 2. Find "Wist - Wishlist & Price Tracker"
// 3. Copy the ID shown under the extension name (looks like: abcdefghijklmnop...)
// 4. Paste it below and save this file
// 5. Refresh your Wist dashboard page to sync the token
const EXTENSION_ID = "hlgalligngcfiaibgkinhlkaniibjlmh"; // ✅ Current Extension ID 

export default function ExtensionSync() {
  useEffect(() => {
    const syncToken = async (retryCount = 0) => {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session?.access_token) {
        console.log("🔄 Wist: No session found, skipping sync.");
        return;
      }

      if (!EXTENSION_ID) {
        console.warn("⚠️ Wist: Extension ID not configured.");
        return;
      }

      console.log("🔄 Wist: Syncing token to extension...");
      
      try {
        // Check if Chrome extension API is available
        if (typeof window === 'undefined' || !(window as any).chrome || !(window as any).chrome.runtime) {
          console.log("🔄 Wist: Chrome extension API not available (not Chrome browser).");
          return;
        }

        const chrome = (window as any).chrome;
        
        // Send the token to Chrome Extension
        chrome.runtime.sendMessage(
          EXTENSION_ID,
          { action: "SYNC_TOKEN", token: session.access_token },
          (response: any) => {
            if (chrome.runtime.lastError) {
              const error = chrome.runtime.lastError.message;
              console.log("⚠️ Wist: Extension not reachable:", error);
              
              // Retry up to 2 times with delay (extension might be starting up)
              if (retryCount < 2 && error.includes("Could not establish connection")) {
                console.log(`🔄 Wist: Retrying sync in 1 second... (attempt ${retryCount + 1}/2)`);
                setTimeout(() => syncToken(retryCount + 1), 1000);
              }
              return;
            }

            if (response?.success) {
              console.log("✅ Wist Extension Synced!");
            } else {
              console.log("⚠️ Wist: Sync response:", response);
            }
          }
        );
      } catch (e: any) {
        console.log("⚠️ Wist: Sync error:", e.message);
        // Retry once if it's a connection error
        if (retryCount < 1 && e.message?.includes("connection")) {
          setTimeout(() => syncToken(retryCount + 1), 1000);
        }
      }
    };

    // Wait a bit for extension to be ready, then sync
    const timeoutId = setTimeout(() => {
      syncToken();
    }, 500); // 500ms delay to ensure extension is ready
    
    // Also listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.access_token) {
        syncToken();
      }
    });

    return () => {
      clearTimeout(timeoutId);
      subscription.unsubscribe();
    };
  }, []);

  return null; // This component renders nothing
}

