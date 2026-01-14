'use client';

import { useEffect, useState } from 'react';
import ExtensionSync from './ExtensionSync';
import NotificationForwarder from './NotificationForwarder';
import { supabase } from '@/lib/supabase/client';

export default function ClientProvider({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    setMounted(true);
    console.log("✅ [ClientProvider] Mounted - ExtensionSync should now load");

    // Check authentication status and add class to body
    const checkAuth = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      const loggedIn = !!user;
      setIsLoggedIn(loggedIn);
      
      // Add/remove class based on login status
      if (loggedIn) {
        document.body.classList.add('user-logged-in');
        document.documentElement.classList.add('user-logged-in');
      } else {
        document.body.classList.remove('user-logged-in');
        document.documentElement.classList.remove('user-logged-in');
      }
    };

    checkAuth();

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const loggedIn = !!session?.user;
      setIsLoggedIn(loggedIn);
      
      if (loggedIn) {
        document.body.classList.add('user-logged-in');
        document.documentElement.classList.add('user-logged-in');
      } else {
        document.body.classList.remove('user-logged-in');
        document.documentElement.classList.remove('user-logged-in');
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  return (
    <>
      {mounted && (
        <>
          <ExtensionSync />
          <NotificationForwarder />
        </>
      )}
      {children}
    </>
  );
}

