'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import {
  DEFAULT_PALETTE,
  applyPalette,
  readStoredPalette,
  persistPalette,
  type PaletteId,
} from '@zerosky/ui';

// Re-export so consumers can pull the palette catalogue from the provider too.
export { PALETTES } from '@zerosky/ui';
export type { PaletteId, PaletteDef } from '@zerosky/ui';

type Theme = 'light' | 'dark' | 'system';
type ResolvedTheme = 'light' | 'dark';

interface ThemeContextValue {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  resolvedTheme: ResolvedTheme;
  palette: PaletteId;
  setPalette: (palette: PaletteId) => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

const STORAGE_KEY = 'zerosky-theme';

function getStoredTheme(): Theme | null {
  if (typeof window === 'undefined') return null;
  try {
    return (localStorage.getItem(STORAGE_KEY) as Theme) || null;
  } catch {
    return null;
  }
}

function getInitialPalette(): PaletteId {
  if (typeof window === 'undefined') return DEFAULT_PALETTE;
  return readStoredPalette(window.localStorage);
}

function getSystemTheme(): ResolvedTheme {
  if (typeof window === 'undefined') return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => getStoredTheme() || 'light');
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>(() =>
    theme === 'system' ? getSystemTheme() : theme
  );
  const [palette, setPaletteState] = useState<PaletteId>(getInitialPalette);

  // Apply palette independently of mode. This composes with the `.dark` class
  // managed by the mode effects below.
  useEffect(() => {
    applyPalette(document.documentElement, palette);
  }, [palette]);

  useEffect(() => {
    const root = document.documentElement;
    const resolved = theme === 'system' ? getSystemTheme() : theme;
    
    setResolvedTheme(resolved);
    
    if (resolved === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    
    root.style.colorScheme = resolved;
  }, [theme]);

  useEffect(() => {
    if (theme !== 'system') return;

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    
    const handleChange = (e: MediaQueryListEvent) => {
      const resolved = e.matches ? 'dark' : 'light';
      setResolvedTheme(resolved);
      
      const root = document.documentElement;
      if (resolved === 'dark') {
        root.classList.add('dark');
      } else {
        root.classList.remove('dark');
      }
      root.style.colorScheme = resolved;
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [theme]);

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(STORAGE_KEY, newTheme);
    } catch {
      // Private mode or storage unavailable
    }
  };

  const setPalette = (newPalette: PaletteId) => {
    setPaletteState(newPalette);
    if (typeof window === 'undefined') return;
    persistPalette(window.localStorage, newPalette);
  };

  return (
    <ThemeContext.Provider
      value={{ theme, setTheme, resolvedTheme, palette, setPalette }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
}
