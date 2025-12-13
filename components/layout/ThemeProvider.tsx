/**
 * Theme provider wrapper for client-side theme initialization
 */
'use client';

import { useEffect } from 'react';
import { initTheme } from '@/lib/theme';

export default function ThemeProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    if (typeof window !== 'undefined') {
      initTheme();
    }
  }, []);

  return <>{children}</>;
}

