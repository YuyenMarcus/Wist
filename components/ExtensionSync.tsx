'use client';

import { useEffect } from 'react';
import { supabase } from '@/lib/supabase/client';

const EXTENSION_ID = "hlgalligngcfiaibgkinhlkaniibjlmh";

function sendTokenToExtension(session: any) {
  if (!session?.access_token) return;

  const token = session.access_token;

  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    const minutesLeft = Math.floor((payload.exp * 1000 - Date.now()) / 60000);
    console.log(`✅ [ExtensionSync] Sending token (expires in ${minutesLeft}m) for ${session.user?.email}`);
  } catch (_) {}

  if (typeof window === 'undefined' || !(window as any).chrome?.runtime) return;

  const chrome = (window as any).chrome;

  try {
    chrome.runtime.sendMessage(
      EXTENSION_ID,
      {
        type: 'AUTH_TOKEN',
        token,
        session,
        timestamp: Date.now()
      },
      (response: any) => {
        if (chrome.runtime.lastError) {
          console.log("⚠️ [ExtensionSync] Extension not responding:", chrome.runtime.lastError.message);
        } else {
          console.log("✅ [ExtensionSync] Token synced to extension");
        }
      }
    );
  } catch (e) {
    console.log("⚠️ [ExtensionSync] Could not send via chrome.runtime:", e);
  }

  window.postMessage({
    type: 'WIST_AUTH_TOKEN',
    token,
    session,
    timestamp: Date.now()
  }, '*');
}

export default function ExtensionSync() {
  useEffect(() => {
    console.log("🔵 [ExtensionSync] Mounted");

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log("🔔 [ExtensionSync] Auth event:", event);

      if (session && (event === 'INITIAL_SESSION' || event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED')) {
        sendTokenToExtension(session);
      }
    });

    const interval = setInterval(async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) sendTokenToExtension(session);
    }, 10 * 60 * 1000);

    return () => {
      subscription.unsubscribe();
      clearInterval(interval);
    };
  }, []);

  return null;
}
