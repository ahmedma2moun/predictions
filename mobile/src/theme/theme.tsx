import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { Appearance } from 'react-native';
import { type Palette, type ThemeMode, palettes } from './colors';

const STORAGE_KEY = 'fp_theme_mode';

type ThemePref = ThemeMode | 'system';

interface ThemeContextValue {
  mode: ThemeMode;          // resolved (never 'system')
  pref: ThemePref;          // user preference (may be 'system')
  colors: Palette;
  setPref: (p: ThemePref) => void;
  toggle: () => void;       // flips between light and dark (resolves 'system' first)
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function resolve(pref: ThemePref): ThemeMode {
  if (pref === 'system') {
    return Appearance.getColorScheme() === 'light' ? 'light' : 'dark';
  }
  return pref;
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [pref, setPrefState] = useState<ThemePref>('dark');
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const stored = await AsyncStorage.getItem(STORAGE_KEY);
        if (stored === 'light' || stored === 'dark' || stored === 'system') {
          setPrefState(stored);
        }
      } finally {
        setHydrated(true);
      }
    })();
  }, []);

  // Track system changes only when pref === 'system'.
  const [systemMode, setSystemMode] = useState<ThemeMode>(
    Appearance.getColorScheme() === 'light' ? 'light' : 'dark',
  );
  useEffect(() => {
    const sub = Appearance.addChangeListener(({ colorScheme }) => {
      setSystemMode(colorScheme === 'light' ? 'light' : 'dark');
    });
    return () => sub.remove();
  }, []);

  const mode: ThemeMode = pref === 'system' ? systemMode : pref;

  const setPref = (p: ThemePref) => {
    setPrefState(p);
    AsyncStorage.setItem(STORAGE_KEY, p).catch(() => {});
  };

  const toggle = () => {
    const current = resolve(pref);
    setPref(current === 'dark' ? 'light' : 'dark');
  };

  const value = useMemo<ThemeContextValue>(
    () => ({ mode, pref, colors: palettes[mode], setPref, toggle }),
    [mode, pref],
  );

  // Avoid a flash on first paint before AsyncStorage resolves.
  if (!hydrated) return null;

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
