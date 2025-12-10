/**
 * Theme toggle button for dark/light mode
 */
import { useEffect, useState } from 'react';
import { toggleDarkMode, initTheme, isDarkMode } from '@/lib/theme';

export default function ThemeToggle() {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    initTheme();
    setDark(isDarkMode());
  }, []);

  const handleToggle = () => {
    toggleDarkMode();
    setDark(isDarkMode());
  };

  return (
    <button
      onClick={handleToggle}
      className="p-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] hover:bg-[var(--color-bg-secondary)] transition-colors"
      aria-label="Toggle dark mode"
    >
      {dark ? (
        <span className="text-xl">🌙</span>
      ) : (
        <span className="text-xl">☀️</span>
      )}
    </button>
  );
}

