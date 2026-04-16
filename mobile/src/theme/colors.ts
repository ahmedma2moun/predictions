// Theme palettes mirror football-predictions/src/app/globals.css.
// `dark` = FotMob navy + emerald. `light` = clean off-white + emerald.
// Components must pull the active palette via `useTheme()` from `@/theme/theme`
// so the app can hot-switch at runtime. The `colors` export below is the dark
// palette kept for static contexts that can't use the hook (e.g. StatusBar
// defaults during first paint).

export type Palette = {
  background: string;
  backgroundElevated: string;
  card: string;
  cardElevated: string;
  foreground: string;
  mutedForeground: string;
  border: string;
  input: string;
  primary: string;
  primaryForeground: string;
  primarySoft: string;   // tinted surface — e.g. "(you)" row on leaderboard
  primarySoftBorder: string;
  destructive: string;
  accent: string;
  accentHover: string;
  success: string;
  warning: string;
  live: string;
  gold: string;
};

export type ThemeMode = 'light' | 'dark';

export const palettes: Record<ThemeMode, Palette> = {
  dark: {
    background: '#0b1220',
    backgroundElevated: '#10192a',
    card: '#14202f',
    cardElevated: '#1b2736',
    foreground: '#f1f5f9',
    mutedForeground: '#8a9aad',
    border: 'rgba(255,255,255,0.09)',
    input: 'rgba(255,255,255,0.11)',
    primary: '#10b981',
    primaryForeground: '#ffffff',
    primarySoft: 'rgba(16,185,129,0.14)',
    primarySoftBorder: 'rgba(16,185,129,0.35)',
    destructive: '#f43f5e',
    accent: '#1b2736',
    accentHover: '#223044',
    success: '#22c55e',
    warning: '#eab308',
    live: '#f43f5e',
    gold: '#eab308',
  },
  light: {
    background: '#edf0f4',
    backgroundElevated: '#f4f6f9',
    card: '#ffffff',
    cardElevated: '#f5f7fa',
    foreground: '#17202e',
    mutedForeground: '#5d6b7e',
    border: 'rgba(0,0,0,0.10)',
    input: 'rgba(0,0,0,0.08)',
    primary: '#0f9d6b',
    primaryForeground: '#ffffff',
    primarySoft: 'rgba(15,157,107,0.10)',
    primarySoftBorder: 'rgba(15,157,107,0.30)',
    destructive: '#dc2626',
    accent: '#e3e7ed',
    accentHover: '#d6dbe3',
    success: '#16a34a',
    warning: '#ca8a04',
    live: '#e11d48',
    gold: '#d97706',
  },
};

// Back-compat export: the dark palette is the default for consumers that still
// import `colors` directly (e.g. splash pre-theme-provider).
export const colors: Palette = palettes.dark;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
};

export const radius = {
  sm: 6,
  md: 10,
  lg: 14,
  xl: 20,
  pill: 999,
};

export const font = {
  size: {
    xs: 11,
    sm: 13,
    md: 15,
    lg: 17,
    xl: 20,
    xxl: 28,
  },
  weight: {
    regular: '400' as const,
    medium: '500' as const,
    semibold: '600' as const,
    bold: '700' as const,
  },
};
