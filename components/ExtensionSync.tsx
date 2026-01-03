'use client';

import { useEffect, useState } from 'react';

// ⚠️ Ensure this matches the ID from chrome://extensions
const EXTENSION_ID = "hlgalligngcfiaibgkinhlkaniibjlmh"; 

export default function ExtensionSync() {
  useEffect(() => {
    const syncToken = async () => {
      // 1. DIRECT LOCAL STORAGE READ (Matches your working manual script)
      // This bypasses network issues or Supabase SDK loading delays
      let token = null;
      
      try {
        const storageKeys = Object.keys(localStorage).filter(k => k.includes('auth-token'));
        if (storageKeys.length > 0) {
          const rawData = localStorage.getItem(storageKeys[0]);
          if (rawData) {
            const session = JSON.parse(rawData);
            token = session.access_token || session?.currentSession?.access_token;
          }
        }
      } catch (err) {
        console.error("Storage Read Error:", err);
      }

      if (!token) {
        console.log("ℹ️ [AutoSync] No token found in LocalStorage.");
        return;
      }

      // 2. Send to Extension
      if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
        console.log("🔄 [AutoSync] Found token, sending to extension...");
        
        chrome.runtime.sendMessage(
          EXTENSION_ID, 
          { action: "SYNC_TOKEN", token: token },
          (response) => {
            if (chrome.runtime.lastError) {
              console.warn("⚠️ [AutoSync] Extension not ready:", chrome.runtime.lastError.message);
            } else {
              console.log("✅ [AutoSync] SUCCESS! Extension Synced.", response);
            }
          }
        );
      }
    };

    // Run on mount
    syncToken();

    // Run again if the user clicks anywhere (just to be aggressive about syncing)
    window.addEventListener('click', syncToken, { once: true });
    
    // Cleanup
    return () => window.removeEventListener('click', syncToken);
  }, []);

  return null;
}
