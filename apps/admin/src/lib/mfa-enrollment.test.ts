import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  ADMIN_TOTP_ACCOUNT_LABEL,
  ADMIN_TOTP_ISSUER,
  buildAdminOtpauthUrl,
  formatMfaAuthError,
  normalizeTotpInput,
  recoveryCodesText,
} from './mfa-enrollment';

describe('Admin MFA enrollment helpers', () => {
  it('builds a Google Authenticator compatible otpauth URI without an email', () => {
    const url = buildAdminOtpauthUrl('MFRGGZDFMZTWQ2LK');
    expect(
      url.startsWith(
        `otpauth://totp/${encodeURIComponent(ADMIN_TOTP_ISSUER)}:${ADMIN_TOTP_ACCOUNT_LABEL}?`,
      ),
    ).toBe(true);
    expect(url).toContain(`issuer=${encodeURIComponent(ADMIN_TOTP_ISSUER)}`);
    expect(url).toContain('algorithm=SHA1');
    expect(url).toContain('digits=6');
    expect(url).toContain('period=30');
    expect(url).not.toContain('@');
  });

  it('accepts only six TOTP digits', () => {
    expect(normalizeTotpInput('12a34-56')).toBe('123456');
    expect(normalizeTotpInput('1234567')).toBe('123456');
  });

  it('maps invalid and expired codes to non-technical copy', () => {
    expect(formatMfaAuthError({ status: 401, message: 'Invalid authenticator code' })).toContain(
      'incorrect or has expired',
    );
    expect(formatMfaAuthError({ status: 401, message: 'MFA challenge expired' })).toContain(
      'expired',
    );
    expect(formatMfaAuthError({ status: 429, message: 'Too many MFA attempts' })).toContain(
      'Too many attempts',
    );
    expect(formatMfaAuthError({ status: 401, message: 'Invalid authenticator code' })).not.toMatch(
      /JWT|secret|otpauth|stack/i,
    );
  });

  it('formats recovery download text without extra secrets', () => {
    const text = recoveryCodesText(['AAAA-BBBB', 'CCCC-DDDD']);
    expect(text).toContain('Each code can be used once');
    expect(text).toContain('AAAA-BBBB');
    expect(text).not.toMatch(/otpauth|secret=/i);
  });
});

describe('Admin MFA screens', () => {
  it('enrollment page shows Google Authenticator QR setup copy', () => {
    const source = readFileSync(join(__dirname, '../app/mfa/enroll/page.tsx'), 'utf8');
    expect(source).toContain('Set up Google Authenticator');
    expect(source).toContain('Scan a QR code');
    expect(source).toContain('Can’t scan the QR code?');
    expect(source).toContain('I have saved my recovery codes');
    expect(source).toContain('/dashboard?mfa=enabled');
    expect(source).not.toContain('localStorage');
  });

  it('returning login challenge asks for a 6-digit authenticator code', () => {
    const source = readFileSync(join(__dirname, '../app/mfa/page.tsx'), 'utf8');
    expect(source).toContain('Two-factor authentication');
    expect(source).toContain('Enter the 6-digit code from Google Authenticator.');
    expect(source).toContain('Verify & Continue');
    expect(source).not.toContain('otpauth');
  });
});
