export interface ProfileTheme {
  key: string;
  name: string;
  isDark: boolean;
  bg: string;
  text: string;
  textSecondary: string;
  accent: string;
  avatarGradient: string;
  cardBg: string;
  borderColor: string;
}

export const PROFILE_THEMES: Record<string, ProfileTheme> = {
  default: {
    key: 'default',
    name: 'Classic',
    isDark: false,
    bg: 'bg-zinc-50',
    text: 'text-zinc-900',
    textSecondary: 'text-zinc-500',
    accent: 'text-violet-600',
    avatarGradient: 'from-violet-500 to-purple-600',
    cardBg: 'bg-white',
    borderColor: 'border-zinc-200',
  },
  midnight: {
    key: 'midnight',
    name: 'Midnight',
    isDark: true,
    bg: 'bg-zinc-950',
    text: 'text-white',
    textSecondary: 'text-zinc-400',
    accent: 'text-violet-400',
    avatarGradient: 'from-violet-600 to-indigo-700',
    cardBg: 'bg-zinc-900',
    borderColor: 'border-zinc-800',
  },
  ocean: {
    key: 'ocean',
    name: 'Ocean',
    isDark: false,
    bg: 'bg-slate-50',
    text: 'text-slate-900',
    textSecondary: 'text-slate-500',
    accent: 'text-blue-600',
    avatarGradient: 'from-blue-500 to-cyan-600',
    cardBg: 'bg-white',
    borderColor: 'border-blue-100',
  },
  sunset: {
    key: 'sunset',
    name: 'Sunset',
    isDark: false,
    bg: 'bg-amber-50',
    text: 'text-amber-950',
    textSecondary: 'text-amber-700',
    accent: 'text-orange-600',
    avatarGradient: 'from-orange-500 to-amber-600',
    cardBg: 'bg-white',
    borderColor: 'border-amber-200',
  },
  rose: {
    key: 'rose',
    name: 'Rose',
    isDark: false,
    bg: 'bg-pink-50',
    text: 'text-pink-950',
    textSecondary: 'text-pink-600',
    accent: 'text-rose-600',
    avatarGradient: 'from-rose-500 to-pink-600',
    cardBg: 'bg-white',
    borderColor: 'border-rose-200',
  },
  forest: {
    key: 'forest',
    name: 'Forest',
    isDark: false,
    bg: 'bg-emerald-50',
    text: 'text-emerald-950',
    textSecondary: 'text-emerald-600',
    accent: 'text-emerald-600',
    avatarGradient: 'from-emerald-500 to-green-600',
    cardBg: 'bg-white',
    borderColor: 'border-emerald-200',
  },
  abyss: {
    key: 'abyss',
    name: 'Abyss',
    isDark: true,
    bg: 'bg-slate-950',
    text: 'text-slate-50',
    textSecondary: 'text-slate-400',
    accent: 'text-cyan-400',
    avatarGradient: 'from-cyan-500 to-blue-600',
    cardBg: 'bg-slate-900',
    borderColor: 'border-slate-800',
  },
  ember: {
    key: 'ember',
    name: 'Ember',
    isDark: true,
    bg: 'bg-neutral-950',
    text: 'text-orange-50',
    textSecondary: 'text-orange-300/70',
    accent: 'text-orange-400',
    avatarGradient: 'from-orange-500 to-red-600',
    cardBg: 'bg-neutral-900',
    borderColor: 'border-neutral-800',
  },
  lavender: {
    key: 'lavender',
    name: 'Lavender',
    isDark: false,
    bg: 'bg-violet-50',
    text: 'text-violet-950',
    textSecondary: 'text-violet-500',
    accent: 'text-violet-600',
    avatarGradient: 'from-violet-400 to-fuchsia-500',
    cardBg: 'bg-white',
    borderColor: 'border-violet-200',
  },
};

export const THEME_KEYS = Object.keys(PROFILE_THEMES);

export function getProfileTheme(key: string | null | undefined): ProfileTheme {
  return PROFILE_THEMES[key || 'default'] || PROFILE_THEMES.default;
}
