// Mirrors football-predictions/src/app/globals.css — FotMob navy charcoal
// with emerald accent. Dark theme is the default for mobile.

export const colors = {
  background: '#0b1220',
  card: '#14202f',
  cardElevated: '#1b2736',
  foreground: '#f1f5f9',
  mutedForeground: '#8a9aad',
  border: 'rgba(255,255,255,0.09)',
  input: 'rgba(255,255,255,0.11)',
  primary: '#10b981',
  primaryForeground: '#ffffff',
  destructive: '#f43f5e',
  accent: '#1b2736',
  success: '#22c55e',
  warning: '#eab308',
  live: '#f43f5e',
};

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
