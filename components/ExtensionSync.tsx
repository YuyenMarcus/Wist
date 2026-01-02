'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';

// ⚠️ CRITICAL: Replace this with the ID from chrome://extensions
const EXTENSION_ID = "hlgalligngcfiaibgkinhlkaniibjlmh"; 

export default function ExtensionSync() {
  const [status, setStatus] = useState<'idle' | 'syncing' | 'success' | 'error'>('idle');

  useEffect(() => {
    const syncToken = async () => {
      // 1. Get the session from Supabase
      const { data: { session } } = await supabase.auth.getSession();

      // If not logged in, nothing to sync
      if (!session?.access_token) {
        return;
      }

      setStatus('syncing');

      // 2. Retry Logic: Try 3 times with a delay (Wake up the extension)
      let attempts = 0;
      const maxAttempts = 3;
      let synced = false;

      while (attempts < maxAttempts && !synced) {
        try {
          await new Promise<void>((resolve, reject) => {
            // Check if Chrome runtime is available
            if (typeof window === 'undefined' || !(window as any).chrome || !(window as any).chrome.runtime) {
              resolve(); // Not Chrome, just exit
              return;
            }

            const chrome = (window as any).chrome;
            console.log(`🔄 Wist: Sync Attempt ${attempts + 1}/${maxAttempts}...`);
            
            // Use action: "SYNC_TOKEN" to match background.js listener
            chrome.runtime.sendMessage(
              EXTENSION_ID, 
              { action: "SYNC_TOKEN", token: session.access_token },
              (response: any) => {
                if (chrome.runtime.lastError) {
                  // Extension dormant or ID wrong
                  reject(new Error(chrome.runtime.lastError.message));
                } else {
                  // Success!
                  console.log("✅ Wist Extension Synced!", response);
                  setStatus('success');
                  synced = true;
                  resolve();
                }
              }
            );
          });
        } catch (error: any) {
          attempts++;
          console.log(`⚠️ Wist: Attempt ${attempts} failed:`, error.message);
          // Wait 1 second before retrying to let extension wake up
          if (attempts < maxAttempts) {
            await new Promise(r => setTimeout(r, 1000));
          }
        }
      }

      if (!synced) {
        console.warn("⚠️ Wist: Could not sync to extension after 3 attempts. Is it installed?");
        setStatus('error');
      }
    };

    // Wait a bit for extension to be ready, then sync
    const timeoutId = setTimeout(() => {
      syncToken();
    }, 500); // 500ms delay to ensure extension is ready

    // Also listen for auth changes (login/logout)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session?.access_token) {
        syncToken();
      }
    });

    return () => {
      clearTimeout(timeoutId);
      subscription.unsubscribe();
    };
  }, []);

  return null; // This component is invisible
}
