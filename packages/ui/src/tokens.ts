export const tokens = {
  color: {
    ink: '#0B1220',
    paper: '#F7F4EF',
    accent: '#0F6E56',
    accentMuted: '#D7EDE6',
    danger: '#B42318',
    warn: '#7A2E0E',
    success: '#0F6E56',
    border: '#D6D3CD',
    muted: 'rgba(11, 18, 32, 0.65)',
  },

  font: {
    sans: '"IBM Plex Sans", "Segoe UI", sans-serif',
    mono: '"IBM Plex Mono", ui-monospace, monospace',
  },
  radius: {
    sm: '6px',
    md: '10px',
  },
  space: {
    xs: '0.25rem',
    sm: '0.5rem',
    md: '1rem',
    lg: '1.5rem',
    xl: '2.5rem',
  },
} as const;

export type Tokens = typeof tokens;
