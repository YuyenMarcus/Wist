'use client';

import { useEffect, useState } from 'react';

export default function ExtensionTestPage() {
  const [logs, setLogs] = useState<string[]>([]);
  const [tokenInfo, setTokenInfo] = useState<any>(null);

  useEffect(() => {
    // Capture console.log messages
    const originalLog = console.log;
    console.log = (...args) => {
      const message = args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ');
      if (message.includes('[ExtensionSync]')) {
        setLogs(prev => [...prev, `${new Date().toLocaleTimeString()} - ${message}`]);
      }
      originalLog(...args);
    };

    // Check for token in localStorage
    const checkToken = () => {
      const keys = Object.keys(localStorage);
      const authKey = keys.find(k => k.includes('supabase') && k.includes('auth'));
      
      if (authKey) {
        try {
          const data = JSON.parse(localStorage.getItem(authKey) || '{}');
          const token = data.access_token || data.currentSession?.access_token;
          
          if (token) {
            const payload = JSON.parse(atob(token.split('.')[1]));
            const expiresAt = new Date(payload.exp * 1000);
            const now = new Date();
            const minutesUntilExpiry = Math.floor((expiresAt.getTime() - now.getTime()) / 60000);
            
            setTokenInfo({
              email: payload.email,
              expiresAt: expiresAt.toLocaleString(),
              minutesUntilExpiry,
              tokenLength: token.length,
              isExpired: minutesUntilExpiry < 0
            });
          }
        } catch (e) {
          console.error('Error parsing token:', e);
        }
      }
    };

    checkToken();
    const interval = setInterval(checkToken, 5000);

    return () => {
      console.log = originalLog;
      clearInterval(interval);
    };
  }, []);

  const manualSync = async () => {
    const keys = Object.keys(localStorage);
    const authKey = keys.find(k => k.includes('supabase') && k.includes('auth'));
    
    if (!authKey) {
      alert('No auth token found in localStorage!');
      return;
    }

    try {
      const data = JSON.parse(localStorage.getItem(authKey) || '{}');
      const token = data.access_token || data.currentSession?.access_token;
      
      if (!token) {
        alert('Could not extract token!');
        return;
      }

      const extensionId = 'hlgalligngcfiaibgkinhlkaniibjlmh';
      
      if (typeof chrome === 'undefined' || !chrome.runtime) {
        alert('Chrome extension API not available!');
        return;
      }
      
      chrome.runtime.sendMessage(
        extensionId,
        {
          type: 'AUTH_TOKEN',
          token: token,
          session: data,
          timestamp: Date.now()
        },
        (response) => {
          if (chrome.runtime.lastError) {
            alert(`Extension error: ${chrome.runtime.lastError.message}`);
          } else {
            alert(`✅ Token synced! Response: ${JSON.stringify(response)}`);
          }
        }
      );
    } catch (e: any) {
      alert(`Error: ${e.message}`);
    }
  };

  return (
    <div style={{ padding: '20px', fontFamily: 'monospace', maxWidth: '800px', margin: '0 auto' }}>
      <h1>🔍 Extension Sync Diagnostic</h1>
      
      <div style={{ marginBottom: '20px', padding: '15px', background: '#f5f5f5', borderRadius: '5px' }}>
        <h2>Token Status</h2>
        {tokenInfo ? (
          <div>
            <p><strong>Email:</strong> {tokenInfo.email}</p>
            <p><strong>Expires:</strong> {tokenInfo.expiresAt}</p>
            <p><strong>Time until expiry:</strong> {tokenInfo.minutesUntilExpiry} minutes</p>
            <p><strong>Token length:</strong> {tokenInfo.tokenLength}</p>
            <p style={{ color: tokenInfo.isExpired ? 'red' : 'green', fontWeight: 'bold' }}>
              <strong>Status:</strong> {tokenInfo.isExpired ? '❌ EXPIRED' : '✅ Valid'}
            </p>
          </div>
        ) : (
          <p>No token found in localStorage</p>
        )}
      </div>

      <button 
        onClick={manualSync}
        style={{
          padding: '10px 20px',
          background: '#0070f3',
          color: 'white',
          border: 'none',
          borderRadius: '5px',
          cursor: 'pointer',
          marginBottom: '20px',
          fontSize: '16px'
        }}
      >
        🔄 Manual Sync to Extension
      </button>

      <div style={{ padding: '15px', background: '#000', color: '#0f0', borderRadius: '5px', minHeight: '200px', maxHeight: '400px', overflowY: 'auto' }}>
        <h2 style={{ color: '#0f0', marginTop: 0 }}>ExtensionSync Console Logs</h2>
        {logs.length > 0 ? (
          logs.map((log, i) => <div key={i} style={{ marginBottom: '5px' }}>{log}</div>)
        ) : (
          <div style={{ color: '#ff0' }}>No ExtensionSync logs detected yet... Check browser console (F12) for logs.</div>
        )}
      </div>

      <div style={{ marginTop: '20px', padding: '15px', background: '#fffbea', borderRadius: '5px' }}>
        <h3>Expected Logs (if working):</h3>
        <pre style={{ background: '#f5f5f5', padding: '10px', borderRadius: '3px', overflow: 'auto' }}>{`🔵 [ExtensionSync] Component mounted
🔵 [ExtensionSync] Syncing token...
✅ [ExtensionSync] Fresh token obtained, length: 867
⏰ [ExtensionSync] Token expires in: 60 minutes
👤 [ExtensionSync] User: your@email.com
✅ [ExtensionSync] Token synced to extension
📡 [ExtensionSync] Token broadcast complete`}</pre>
      </div>
    </div>
  );
}

