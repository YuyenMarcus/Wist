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
    const syncToken = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session?.access_token && EXTENSION_ID) {
        console.log("🔄 Wist: Syncing token to extension...");
        
        try {
          // Send the token to Chrome Extension
          if (typeof window !== 'undefined' && (window as any).chrome && (window as any).chrome.runtime) {
            const chrome = (window as any).chrome;
            chrome.runtime.sendMessage(
              EXTENSION_ID,
              { action: "SYNC_TOKEN", token: session.access_token },
              (response: any) => {
                if (response?.success) {
                  console.log("✅ Wist Extension Synced!");
                } else if (chrome.runtime.lastError) {
                  // Extension not installed or ID wrong, ignore silently
                  console.log("Extension not reachable:", chrome.runtime.lastError.message);
                }
              }
            );
          }
        } catch (e) {
          // Extension not installed or ID wrong, ignore
          console.log("Extension not reachable.");
        }
      }
    };

    // Run immediately on mount
    syncToken();
    
    // Also listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.access_token) {
        syncToken();
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  return null; // This component renders nothing
}

