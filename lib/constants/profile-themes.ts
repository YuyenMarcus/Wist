export interface ProfileTheme {
  key: string;
  name: string;
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
    bg: 'bg-emerald-50',
    text: 'text-emerald-950',
    textSecondary: 'text-emerald-600',
    accent: 'text-emerald-600',
    avatarGradient: 'from-emerald-500 to-green-600',
    cardBg: 'bg-white',
    borderColor: 'border-emerald-200',
  },
};

export const THEME_KEYS = Object.keys(PROFILE_THEMES);

export function getProfileTheme(key: string | null | undefined): ProfileTheme {
  return PROFILE_THEMES[key || 'default'] || PROFILE_THEMES.default;
}
