'use client';

import { useEffect, useState } from 'react';

// ⚠️ CONFIRM THIS ID MATCHES YOUR CHROME://EXTENSIONS
const EXTENSION_ID = "hlgalligngcfiaibgkinhlkaniibjlmh"; 

export default function ExtensionSync() {
  const [msg, setMsg] = useState("Initializing...");
  const [color, setColor] = useState("bg-gray-800");

  const runSync = () => {
    setMsg("Syncing...");
    setColor("bg-yellow-600");

    // 1. Get Token directly from Storage (Bypass Supabase SDK)
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
    } catch (e) { 
      console.error("Storage Read Error:", e);
      setMsg("Storage Error");
      setColor("bg-red-600");
      return;
    }

    if (!token) {
      setMsg("No Token Found");
      setColor("bg-red-600");
      return;
    }

    // 2. Check if Chrome API exists
    if (typeof window === 'undefined' || !(window as any).chrome || !(window as any).chrome.runtime) {
      setMsg("Not Chrome?");
      setColor("bg-red-600");
      return;
    }

    const chrome = (window as any).chrome;

    // 3. Send
    console.log("🚀 [AutoSync] Sending token to", EXTENSION_ID);
    chrome.runtime.sendMessage(
      EXTENSION_ID, 
      { action: "SYNC_TOKEN", token: token },
      (response: any) => {
        if (chrome.runtime.lastError) {
          console.error("❌ Sync Error:", chrome.runtime.lastError.message);
          setMsg("Error: " + chrome.runtime.lastError.message.substring(0, 20));
          setColor("bg-red-600");
        } else {
          console.log("✅ Sync Success:", response);
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
  };

  // Run automatically on mount
  useEffect(() => {
    runSync();
  }, []);

  // RENDER A VISIBLE DEBUG BUTTON
  return (
    <div 
      onClick={runSync}
      className={`fixed bottom-4 right-4 ${color} text-white px-4 py-2 rounded shadow-lg cursor-pointer z-[9999] text-xs font-mono transition-all`}
    >
      [Wist Sync] {msg}
    </div>
  );
}
