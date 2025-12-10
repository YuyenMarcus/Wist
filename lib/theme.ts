/**
 * Theme utilities for dark mode toggling
 */

export function toggleDarkMode(): void {
  const html = document.documentElement;
  const isDark = html.classList.contains('dark');
  
  if (isDark) {
    html.classList.remove('dark');
    localStorage.setItem('theme', 'light');
  } else {
    html.classList.add('dark');
    localStorage.setItem('theme', 'dark');
  }
}

export function initTheme(): void {
  // Check localStorage or system preference
  const stored = localStorage.getItem('theme');
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  
  const html = document.documentElement;
  
  if (stored === 'dark' || (!stored && prefersDark)) {
    html.classList.add('dark');
  } else {
    html.classList.remove('dark');
  }
}

export function isDarkMode(): boolean {
  return document.documentElement.classList.contains('dark');
}

