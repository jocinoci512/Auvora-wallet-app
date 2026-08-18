import {
  generateTotpCode,
  generateTotpSecret,
  buildOtpauthUrl,
  normalizeRecoveryCode,
  verifyTotpCode,
  TOTP_ISSUER,
  TOTP_ACCOUNT_LABEL,
} from './totp';

describe('TOTP', () => {
  it('round-trips a valid code in the current window', () => {
    const secret = generateTotpSecret();
    const nowMs = Date.parse('2026-08-16T12:00:00.000Z');
    const step = Math.floor(nowMs / 1000 / 30);
    const code = generateTotpCode(secret, step);
    expect(verifyTotpCode({ secret, code, nowMs })).toEqual({ ok: true, step });
  });

  it('accepts the previous 30-second window', () => {
    const secret = generateTotpSecret();
    const nowMs = Date.parse('2026-08-16T12:00:20.000Z');
    const previousStep = Math.floor(nowMs / 1000 / 30) - 1;
    const code = generateTotpCode(secret, previousStep);
    expect(verifyTotpCode({ secret, code, nowMs })).toEqual({ ok: true, step: previousStep });
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

  it('builds a Google Authenticator compatible otpauth URI', () => {
    const url = buildOtpauthUrl({
      secret: 'MFRGGZDFMZTWQ2LK',
      accountName: TOTP_ACCOUNT_LABEL,
      issuer: TOTP_ISSUER,
    });
    expect(url.startsWith('otpauth://totp/Auvora%20Wallet:Admin?')).toBe(true);
    expect(url).toContain('issuer=Auvora%20Wallet');
    expect(url).toContain('algorithm=SHA1');
    expect(url).toContain('digits=6');
    expect(url).toContain('period=30');
    expect(url).not.toContain('@');
  });

  it('normalizes recovery codes', () => {
    expect(normalizeRecoveryCode('ab12-cd34')).toBe('AB12CD34');
  });
});
