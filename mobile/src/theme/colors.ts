// Theme palettes — Scoreboard edition: graphite stadium panels + amber LED accent.
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
  // ── Dark — Scoreboard (graphite panels + amber LED accent) ───────────────
  dark: {
    background: '#17191B',
    backgroundElevated: '#1D2023',
    card: '#212528',
    cardElevated: '#262B2F',
    foreground: '#ECEEEF',
    mutedForeground: '#8B9096',
    border: 'rgba(255,255,255,0.10)',
    input: 'rgba(255,255,255,0.12)',
    primary: '#FF8A1E',
    primaryForeground: '#1A1200',
    primarySoft: 'rgba(255,138,30,0.14)',
    primarySoftBorder: 'rgba(255,138,30,0.32)',
    destructive: '#FF3B30',
    accent: '#262B2F',
    accentHover: '#2E3438',
    success: '#3DDC84',
    warning: '#F2B23D',
    live: '#FF3B30',
    gold: '#F2A93D',
  },
  // ── Light — Scoreboard (poured concrete + amber LED accent) ──────────────
  light: {
    background: '#EDEEEF',
    backgroundElevated: '#F5F6F6',
    card: '#FFFFFF',
    cardElevated: '#F5F6F6',
    foreground: '#1A1D20',
    mutedForeground: '#5C6167',
    border: 'rgba(20,22,24,0.14)',
    input: 'rgba(20,22,24,0.10)',
    primary: '#D9600A',
    primaryForeground: '#FFFFFF',
    primarySoft: 'rgba(217,96,10,0.12)',
    primarySoftBorder: 'rgba(217,96,10,0.32)',
    destructive: '#C81E1E',
    accent: '#E4E5E6',
    accentHover: '#D9DADB',
    success: '#1E8A4C',
    warning: '#B8860B',
    live: '#C81E1E',
    gold: '#B8720A',
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
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
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
