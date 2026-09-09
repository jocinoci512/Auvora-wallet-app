/**
 * Auvora design tokens — JS mirror of CSS custom properties in styles.css.
 * Prefer CSS variables at runtime; use these for typed defaults and docs.
 */

export type ThemeMode = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';

export const THEME_STORAGE_KEY = 'auvora-theme';

export const colorLight = {
  primary: '#087F75',
  primaryHover: '#066A62',
  primaryPressed: '#055650',
  primaryMuted: '#B9F4D7',
  secondary: '#49605E',
  success: '#067647',
  successBg: '#ecfdf3',
  successBorder: '#abefc6',
  warning: '#7a2e0e',
  warningBg: '#fffaeb',
  warningBorder: '#fedf89',
  error: '#b42318',
  errorBg: '#fef3f2',
  errorBorder: '#fecdca',
  info: '#175cd3',
  infoBg: '#eff8ff',
  infoBorder: '#b2ddff',
  background: '#F2F6F3',
  backgroundSubtle: '#DEE8E3',
  surface: 'rgba(255, 255, 255, 0.72)',
  surfaceSolid: '#ffffff',
  border: '#DEE8E3',
  text: '#102D32',
  textMuted: 'rgba(16, 45, 50, 0.65)',
  textInverse: '#ffffff',
  hover: 'rgba(8, 127, 117, 0.08)',
  pressed: 'rgba(8, 127, 117, 0.14)',
  disabled: 'rgba(16, 45, 50, 0.38)',
  focus: '#087F75',
  /** @deprecated use primary — kept for legacy consumers */
  accent: '#087F75',
  accentMuted: '#B9F4D7',
  ink: '#102D32',
  paper: '#F2F6F3',
  danger: '#b42318',
  dangerBg: '#fef3f2',
  dangerBorder: '#fecdca',
  warn: '#7a2e0e',
  warnBg: '#fffaeb',
  warnBorder: '#fedf89',
  muted: 'rgba(16, 45, 50, 0.65)',
} as const;

export const colorDark = {
  primary: '#B9F4D7',
  primaryHover: '#d2f9e4',
  primaryPressed: '#087F75',
  primaryMuted: '#1a3d3a',
  secondary: '#9db0c0',
  success: '#3dba9a',
  successBg: '#0f2a22',
  successBorder: '#1f5c4a',
  warning: '#f5b942',
  warningBg: '#2a2110',
  warningBorder: '#5c4a1f',
  error: '#f97066',
  errorBg: '#2a1210',
  errorBorder: '#5c2a1f',
  info: '#84caff',
  infoBg: '#10202a',
  infoBorder: '#1f4a5c',
  background: '#102D32',
  backgroundSubtle: '#0c2428',
  surface: 'rgba(22, 40, 44, 0.92)',
  surfaceSolid: '#163036',
  border: '#2a454a',
  text: '#F2F6F3',
  textMuted: 'rgba(242, 246, 243, 0.68)',
  textInverse: '#102D32',
  hover: 'rgba(185, 244, 215, 0.12)',
  pressed: 'rgba(185, 244, 215, 0.2)',
  disabled: 'rgba(242, 246, 243, 0.38)',
  focus: '#B9F4D7',
  accent: '#B9F4D7',
  accentMuted: '#1a3d3a',
  ink: '#F2F6F3',
  paper: '#102D32',
  danger: '#f97066',
  dangerBg: '#2a1210',
  dangerBorder: '#5c2a1f',
  warn: '#f5b942',
  warnBg: '#2a2110',
  warnBorder: '#5c4a1f',
  muted: 'rgba(242, 246, 243, 0.68)',
} as const;

export const space = {
  '0': '0',
  '1': '0.25rem',
  '2': '0.5rem',
  '3': '0.75rem',
  '4': '1rem',
  '5': '1.25rem',
  '6': '1.5rem',
  '8': '2rem',
  '10': '2.5rem',
  '12': '3rem',
  '16': '4rem',
  xs: '0.25rem',
  sm: '0.5rem',
  md: '0.75rem',
  lg: '1rem',
  xl: '1.5rem',
  '2xl': '2rem',
} as const;

export const radius = {
  none: '0',
  sm: '6px',
  md: '10px',
  lg: '14px',
  full: '9999px',
} as const;

export const font = {
  sans: "var(--auvora-font-sans), 'IBM Plex Sans', 'Segoe UI', sans-serif",
  mono: "var(--auvora-font-mono), 'IBM Plex Mono', ui-monospace, monospace",
} as const;

export const typography = {
  display: { size: '2.75rem', weight: 700, lineHeight: 1.15, letterSpacing: '-0.04em' },
  h1: { size: '2rem', weight: 700, lineHeight: 1.2, letterSpacing: '-0.03em' },
  h2: { size: '1.5rem', weight: 600, lineHeight: 1.25, letterSpacing: '-0.02em' },
  h3: { size: '1.25rem', weight: 600, lineHeight: 1.3, letterSpacing: '-0.01em' },
  h4: { size: '1.125rem', weight: 600, lineHeight: 1.35, letterSpacing: '0' },
  h5: { size: '1rem', weight: 600, lineHeight: 1.4, letterSpacing: '0' },
  h6: { size: '0.875rem', weight: 600, lineHeight: 1.4, letterSpacing: '0.01em' },
  body: { size: '1rem', weight: 400, lineHeight: 1.6, letterSpacing: '0' },
  caption: { size: '0.8125rem', weight: 400, lineHeight: 1.45, letterSpacing: '0' },
  label: { size: '0.875rem', weight: 500, lineHeight: 1.35, letterSpacing: '0.01em' },
  button: { size: '0.9375rem', weight: 600, lineHeight: 1.25, letterSpacing: '0' },
  mono: { size: '0.875rem', weight: 400, lineHeight: 1.5, letterSpacing: '0' },
} as const;

export const elevation = {
  none: 'none',
  sm: '0 1px 2px rgba(11, 18, 32, 0.06)',
  md: '0 4px 12px rgba(11, 18, 32, 0.08)',
  lg: '0 12px 32px rgba(11, 18, 32, 0.12)',
} as const;

export const zIndex = {
  base: 0,
  dropdown: 100,
  sticky: 200,
  overlay: 300,
  modal: 400,
  toast: 500,
  tooltip: 600,
} as const;

export const motion = {
  fast: '120ms',
  normal: '200ms',
  slow: '320ms',
  easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)',
} as const;

export const iconSize = {
  sm: 16,
  md: 20,
  lg: 24,
} as const;

/** Legacy-compatible token bag used by older components */
export const tokens = {
  color: colorLight,
  space,
  radius,
  font,
  typography,
  elevation,
  zIndex,
  motion,
  iconSize,
} as const;

export type Tokens = typeof tokens;

export type CssVarName = `--auvora-${string}`;

export function cssVar(name: string, fallback?: string): string {
  const key = name.startsWith('--') ? name : `--auvora-${name}`;
  return fallback ? `var(${key}, ${fallback})` : `var(${key})`;
}
