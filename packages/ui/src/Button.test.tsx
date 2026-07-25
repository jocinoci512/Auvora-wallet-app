import { Button } from './Button';
import { tokens } from './tokens';

describe('Button', () => {
  it('is a callable component', () => {
    expect(typeof Button).toBe('function');
  });

  it('exposes design tokens', () => {
    expect(tokens.color.accent).toMatch(/^#/);
    expect(tokens.font.sans.length).toBeGreaterThan(0);
  });
});
