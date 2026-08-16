import {
  generateTotpCode,
  generateTotpSecret,
  normalizeRecoveryCode,
  verifyTotpCode,
} from './totp';

describe('TOTP', () => {
  it('round-trips a valid code in the current window', () => {
    const secret = generateTotpSecret();
    const nowMs = Date.parse('2026-08-16T12:00:00.000Z');
    const step = Math.floor(nowMs / 1000 / 30);
    const code = generateTotpCode(secret, step);
    expect(verifyTotpCode({ secret, code, nowMs })).toEqual({ ok: true, step });
  });

  it('rejects an invalid code', () => {
    const secret = generateTotpSecret();
    expect(verifyTotpCode({ secret, code: '000000', nowMs: Date.now() }).ok).toBe(false);
  });

  it('rejects replay of the same step', () => {
    const secret = generateTotpSecret();
    const nowMs = Date.parse('2026-08-16T12:00:00.000Z');
    const step = Math.floor(nowMs / 1000 / 30);
    const code = generateTotpCode(secret, step);
    expect(verifyTotpCode({ secret, code, nowMs, lastUsedStep: step }).ok).toBe(false);
  });

  it('normalizes recovery codes', () => {
    expect(normalizeRecoveryCode('ab12-cd34')).toBe('AB12CD34');
  });
});
