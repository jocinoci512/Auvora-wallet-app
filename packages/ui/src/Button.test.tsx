import { Button } from './Button';
import { cssVar, tokens, THEME_STORAGE_KEY } from './tokens';

describe('Button', () => {
  it('is a callable component', () => {
    expect(typeof Button).toBe('function');
  });

  it('exposes design tokens', () => {
    expect(tokens.color.primary).toMatch(/^#/);
    expect(tokens.color.accent).toMatch(/^#/);
    expect(tokens.font.sans.length).toBeGreaterThan(0);
    expect(tokens.space['4']).toBe('1rem');
  });
});

describe('tokens helpers', () => {
  it('builds css var references', () => {
    expect(cssVar('color-primary')).toBe('var(--auvora-color-primary)');
    expect(cssVar('--auvora-space-4', '1rem')).toBe('var(--auvora-space-4, 1rem)');
  });

  it('exports theme storage key', () => {
    expect(THEME_STORAGE_KEY).toBe('auvora-theme');
  });
});
