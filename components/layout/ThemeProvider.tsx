'use client';

import { DarkModeProvider } from '@/lib/hooks/useDarkMode';

export default function ThemeProvider({ children }: { children: React.ReactNode }) {
  return <DarkModeProvider>{children}</DarkModeProvider>;
}
