'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactElement,
  type ReactNode,
} from 'react';
import { THEME_STORAGE_KEY, type ResolvedTheme, type ThemeMode } from '../tokens';

export interface ThemeContextValue {
  theme: ThemeMode;
  /** Resolved light/dark after system preference */
  resolved: ResolvedTheme;
  /** Alias for `resolved` */
  resolvedTheme: ResolvedTheme;
  setTheme: (mode: ThemeMode) => void;
  cycleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function getSystemTheme(): ResolvedTheme {
  if (typeof window === 'undefined') return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function resolveTheme(mode: ThemeMode): ResolvedTheme {
  return mode === 'system' ? getSystemTheme() : mode;
}

function applyDomTheme(resolved: ResolvedTheme): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  root.setAttribute('data-theme', resolved);
  root.classList.toggle('auvora-theme-dark', resolved === 'dark');
  root.classList.toggle('auvora-theme-light', resolved === 'light');
  root.style.colorScheme = resolved;
}

function readStoredTheme(storageKey: string): ThemeMode | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (raw === 'light' || raw === 'dark' || raw === 'system') return raw;
  } catch {
    /* ignore */
  }
  return null;
}

export interface ThemeProviderProps {
  children: ReactNode;
  /** Initial theme before hydration; default system */
  defaultTheme?: ThemeMode;
  storageKey?: string;
}

export function ThemeProvider({
  children,
  defaultTheme = 'system',
  storageKey = THEME_STORAGE_KEY,
}: ThemeProviderProps): ReactElement {
  const [theme, setThemeState] = useState<ThemeMode>(defaultTheme);
  const [resolved, setResolved] = useState<ResolvedTheme>('light');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const stored = readStoredTheme(storageKey);
    const next = stored ?? defaultTheme;
    setThemeState(next);
    const r = resolveTheme(next);
    setResolved(r);
    applyDomTheme(r);
    setMounted(true);
  }, [defaultTheme, storageKey]);

  useEffect(() => {
    if (!mounted) return;
    const r = resolveTheme(theme);
    setResolved(r);
    applyDomTheme(r);
    try {
      window.localStorage.setItem(storageKey, theme);
    } catch {
      /* ignore */
    }
  }, [theme, mounted, storageKey]);

  useEffect(() => {
    if (theme !== 'system') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = (): void => {
      const r = getSystemTheme();
      setResolved(r);
      applyDomTheme(r);
    };
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [theme]);

  const setTheme = useCallback((mode: ThemeMode) => {
    setThemeState(mode);
  }, []);

  const cycleTheme = useCallback(() => {
    setThemeState((current) => {
      if (current === 'light') return 'dark';
      if (current === 'dark') return 'system';
      return 'light';
    });
  }, []);

  const value = useMemo(
    () => ({
      theme,
      resolved,
      resolvedTheme: resolved,
      setTheme,
      cycleTheme,
    }),
    [theme, resolved, setTheme, cycleTheme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return ctx;
}
