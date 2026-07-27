'use client';

/**
 * Light / dark theme.
 *
 * The hard part is not storing the preference — it is that the browser paints
 * the page before React hydrates. Read the stored theme in a `useEffect` and
 * a user with dark mode selected gets a white flash on every navigation.
 * `app/layout.tsx` therefore runs a tiny blocking script (`THEME_INIT_SCRIPT`
 * below) in `<head>` that sets the class before first paint; this provider
 * only keeps React's state in sync with what that script already did.
 *
 * `suppressHydrationWarning` on `<html>` is required, and is not a
 * workaround: the script deliberately mutates the element between the server
 * render and hydration, so React's mismatch warning is a false positive here.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

export type Theme = 'light' | 'dark' | 'system';

const STORAGE_KEY = 'theme';

interface ThemeContextValue {
  theme: Theme;
  /** What is actually applied once `system` is resolved. */
  resolvedTheme: 'light' | 'dark';
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

/**
 * Inlined in <head> by the root layout. Keep it small and dependency-free —
 * it blocks the first paint, which is exactly why it prevents the flash.
 */
export const THEME_INIT_SCRIPT = `
(function() {
  try {
    var stored = localStorage.getItem('${STORAGE_KEY}');
    var prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    var theme = stored === 'light' || stored === 'dark'
      ? stored
      : (prefersDark ? 'dark' : 'light');
    document.documentElement.classList.toggle('dark', theme === 'dark');
    document.documentElement.style.colorScheme = theme;
  } catch (e) {}
})();
`.trim();

function systemTheme(): 'light' | 'dark' {
  if (typeof window === 'undefined') return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function applyTheme(resolved: 'light' | 'dark') {
  const root = document.documentElement;
  root.classList.toggle('dark', resolved === 'dark');
  // Tells the browser to render native form controls and scrollbars to match.
  root.style.colorScheme = resolved;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  // 'system' as the initial value so the server render and the first client
  // render agree. The blocking script has already applied the real theme to
  // the DOM; the effect below reconciles state without touching the class.
  const [theme, setThemeState] = useState<Theme>('system');
  const [resolvedTheme, setResolvedTheme] = useState<'light' | 'dark'>('light');

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY) as Theme | null;
    const initial: Theme = stored ?? 'system';
    setThemeState(initial);
    setResolvedTheme(initial === 'system' ? systemTheme() : initial);
  }, []);

  // Follow the OS preference live while the user is on 'system'. Without
  // this, switching the OS to dark mode does nothing until a reload.
  useEffect(() => {
    if (theme !== 'system') return;

    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => {
      const resolved = media.matches ? 'dark' : 'light';
      setResolvedTheme(resolved);
      applyTheme(resolved);
    };

    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, [theme]);

  const setTheme = useCallback((next: Theme) => {
    setThemeState(next);
    const resolved = next === 'system' ? systemTheme() : next;
    setResolvedTheme(resolved);
    applyTheme(resolved);

    try {
      if (next === 'system') {
        window.localStorage.removeItem(STORAGE_KEY);
      } else {
        window.localStorage.setItem(STORAGE_KEY, next);
      }
    } catch {
      // Private browsing or a storage policy. The theme still applies for
      // this session; it just will not persist.
    }
  }, []);

  const value = useMemo(
    () => ({ theme, resolvedTheme, setTheme }),
    [theme, resolvedTheme, setTheme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used inside <ThemeProvider>');
  return context;
}
