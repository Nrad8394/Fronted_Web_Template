'use client';

/**
 * Light / dark / system switch.
 *
 * The theme layer already existed — tokens for both schemes, a provider, and
 * a blocking script that applies the stored choice before first paint — but
 * nothing in the product ever called `setTheme`, so a user was stuck with
 * whatever their OS said. This is that missing control.
 *
 * Three states, not two. A plain light/dark toggle has no way back to
 * "follow the system", and the moment someone taps it once they are opted
 * out of their OS preference forever. Cycling through all three keeps that
 * exit available without a menu.
 *
 * `suppressHydrationWarning` and a mounted guard are deliberate: the server
 * cannot know the stored preference, so the label is rendered only after the
 * provider has read localStorage. Rendering it during SSR would either
 * mismatch or flash the wrong icon.
 */

import { useEffect, useState } from 'react';

import { useTheme, type Theme } from './theme-provider';

const ORDER: Theme[] = ['light', 'dark', 'system'];

const LABEL: Record<Theme, string> = {
  light: 'Light',
  dark: 'Dark',
  system: 'System',
};

/** Simple glyphs — no icon dependency for three states. */
const GLYPH: Record<Theme, string> = {
  light: '☀',
  dark: '☾',
  system: '◐',
};

export function ThemeToggle({ className = '' }: { className?: string }) {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const next = ORDER[(ORDER.indexOf(theme) + 1) % ORDER.length];

  return (
    <button
      type="button"
      onClick={() => setTheme(next)}
      // The accessible name states the current theme AND what the press will
      // do — "Theme: dark" alone leaves a screen-reader user guessing.
      aria-label={mounted ? `Theme: ${LABEL[theme]}. Switch to ${LABEL[next]}.` : 'Theme'}
      title={mounted ? `Theme: ${LABEL[theme]} — switch to ${LABEL[next]}` : 'Theme'}
      className={[
        'inline-flex h-7 min-w-7 items-center justify-center gap-1.5 rounded-md',
        'px-2 text-xs font-medium',
        'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1 focus:ring-offset-background',
        className,
      ].join(' ')}
    >
      <span aria-hidden="true" suppressHydrationWarning>
        {mounted ? GLYPH[theme] : GLYPH.system}
      </span>
      <span className="hidden sm:inline" suppressHydrationWarning>
        {mounted ? LABEL[theme] : ''}
      </span>
    </button>
  );
}

export default ThemeToggle;
