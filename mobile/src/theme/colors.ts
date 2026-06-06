// Theme palettes — World Cup 2026 seasonal edition.
// `dark` = trophy gold on midnight navy. `light` = trophy gold on warm parchment.
// To restore the original Pitch Premium palettes after the World Cup, uncomment
// the "Original Pitch Premium" blocks below and remove the seasonal ones.
// Components pull the active palette via `useTheme()` from `@/theme/theme`.

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
  primarySoft: string;
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
  // ── Dark — World Cup 2026 (trophy gold + midnight navy) ──────────────────
  dark: {
    background: '#07090E',
    backgroundElevated: '#0C1220',
    card: '#101828',
    cardElevated: '#182035',
    foreground: '#F2F5FA',
    mutedForeground: '#8A95A8',
    border: 'rgba(255,255,255,0.06)',
    input: 'rgba(255,255,255,0.10)',
    primary: '#F2A900',
    primaryForeground: '#1A0E00',
    primarySoft: 'rgba(242,169,0,0.12)',
    primarySoftBorder: 'rgba(242,169,0,0.30)',
    destructive: '#FF4D6D',
    accent: '#182035',
    accentHover: '#1F2B45',
    success: '#22c55e',
    warning: '#F2B544',
    live: '#FF4D6D',
    gold: '#F2C744',
  },
  // ── Light — World Cup 2026 (trophy gold + warm parchment) ────────────────
  light: {
    background: '#F5F0E8',
    backgroundElevated: '#FFFFFF',
    card: '#FFFFFF',
    cardElevated: '#FBF7EF',
    foreground: '#17202E',
    mutedForeground: '#5D6B7E',
    border: 'rgba(0,0,0,0.08)',
    input: 'rgba(0,0,0,0.08)',
    primary: '#C8820A',
    primaryForeground: '#FFFFFF',
    primarySoft: 'rgba(200,130,10,0.10)',
    primarySoftBorder: 'rgba(200,130,10,0.30)',
    destructive: '#E11D48',
    accent: '#EDE8DF',
    accentHover: '#E0D9CE',
    success: '#16a34a',
    warning: '#CA8A04',
    live: '#E11D48',
    gold: '#B45309',
  },
};

/*
── Original Pitch Premium dark (restore after World Cup) ──────────────────────
  dark: {
    background: '#07090E',
    backgroundElevated: '#0E121B',
    card: '#141925',
    cardElevated: '#1B2230',
    foreground: '#F2F5FA',
    mutedForeground: '#8A95A8',
    border: 'rgba(255,255,255,0.06)',
    input: 'rgba(255,255,255,0.10)',
    primary: '#10E089',
    primaryForeground: '#031A11',
    primarySoft: 'rgba(16,224,137,0.12)',
    primarySoftBorder: 'rgba(16,224,137,0.30)',
    destructive: '#FF4D6D',
    accent: '#1B2230',
    accentHover: '#232C3D',
    success: '#22c55e',
    warning: '#F2B544',
    live: '#FF4D6D',
    gold: '#F2C744',
  },

── Original Pitch Premium light (restore after World Cup) ─────────────────────
  light: {
    background: '#F4F6FA',
    backgroundElevated: '#FFFFFF',
    card: '#FFFFFF',
    cardElevated: '#F5F7FA',
    foreground: '#17202E',
    mutedForeground: '#5D6B7E',
    border: 'rgba(0,0,0,0.08)',
    input: 'rgba(0,0,0,0.08)',
    primary: '#0DB87A',
    primaryForeground: '#FFFFFF',
    primarySoft: 'rgba(13,184,122,0.10)',
    primarySoftBorder: 'rgba(13,184,122,0.30)',
    destructive: '#E11D48',
    accent: '#E8ECF2',
    accentHover: '#D6DCE6',
    success: '#16a34a',
    warning: '#CA8A04',
    live: '#E11D48',
    gold: '#D97706',
  },
*/

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
  sm: 8,
  md: 14,
  lg: 20,
  xl: 28,
  pill: 999,
};

export const font = {
  size: {
    xxs: 10,
    xs: 11,
    sm: 13,
    md: 15,
    lg: 17,
    xl: 20,
    xxl: 28,
    display: 36,
  },
  weight: {
    regular: '400' as const,
    medium: '500' as const,
    semibold: '600' as const,
    bold: '700' as const,
    heavy: '800' as const,
  },
  family: {
    sans: 'Inter' as const,
    mono: 'JetBrainsMono' as const,
  },
};
