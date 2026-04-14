import Constants from 'expo-constants';

/**
 * Base URL for the Next.js backend.
 *
 * Override via app.json → extra.apiBaseUrl:
 *   • Android emulator → local dev:  'http://10.0.2.2:3000'
 *   • Physical device  → local dev:  'http://<your-machine-ip>:3000'
 *   • Production:                     'https://your-domain.com'
 */
export const API_BASE_URL: string =
  (Constants.expoConfig?.extra as { apiBaseUrl?: string } | undefined)?.apiBaseUrl ??
  'https://predictions-virid.vercel.app';

/** Dark theme colour palette — mirrors the web's dark FotMob-style tokens */
export const Colors = {
  bg:              '#151d28',   // oklch(0.14 0.014 240)
  card:            '#1c2535',   // oklch(0.19 0.016 240)
  cardBorder:      'rgba(255,255,255,0.09)',
  primary:         '#4ade80',   // oklch(0.65 0.22 150) — emerald
  primaryDark:     '#16a34a',
  text:            '#edf1f7',   // oklch(0.96 0.006 240)
  textMuted:       '#8294aa',   // oklch(0.58 0.016 240)
  textDim:         '#5a6f89',
  muted:           '#222d3d',   // oklch(0.25 0.014 240)
  border:          'rgba(255,255,255,0.09)',
  destructive:     '#f87171',
  yellow:          '#fbbf24',
  green:           '#4ade80',
  red:             '#f87171',
  white:           '#ffffff',
  tabBar:          '#121b26',
  tabBarBorder:    'rgba(255,255,255,0.06)',
} as const;
