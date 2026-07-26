import { FixedWindowRateLimiter, redactSensitive, timingSafeEqualString } from './index';

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

  it('rate-limits after window capacity', () => {
    const limiter = new FixedWindowRateLimiter(2, 60_000);
    expect(limiter.consume('ip:1').allowed).toBe(true);
    expect(limiter.consume('ip:1').allowed).toBe(true);
    expect(limiter.consume('ip:1').allowed).toBe(false);
  });
});
