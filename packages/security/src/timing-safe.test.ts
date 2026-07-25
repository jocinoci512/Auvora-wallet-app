import { redactSensitive, timingSafeEqualString } from './index';

describe('security helpers', () => {
  it('compares equal strings', () => {
    expect(timingSafeEqualString('alpha', 'alpha')).toBe(true);
    expect(timingSafeEqualString('alpha', 'beta')).toBe(false);
    expect(timingSafeEqualString('alpha', 'alphas')).toBe(false);
  });

  it('redacts secrets', () => {
    expect(redactSensitive('supersecretvalue')).toMatch(/^supe/);
    expect(redactSensitive('supersecretvalue')).toMatch(/alue$/);
    expect(redactSensitive('ab')).toBe('**');
  });
});
