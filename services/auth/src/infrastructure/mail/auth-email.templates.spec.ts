import {
  buildEmailVerifiedNotice,
  buildNewLoginNotice,
  buildPasswordChangedNotice,
  buildPasswordResetEmail,
  buildSessionRevokedNotice,
  buildVerifyEmail,
  redactMailLogBody,
} from './auth-email.templates';

describe('auth email templates', () => {
  it('builds verify email with CTA, plain text, and anti-phish copy', () => {
    const url = 'https://auvorawallet.com/auth/verify-email?token=abc123';
    const mail = buildVerifyEmail(url);
    expect(mail.subject).toMatch(/Verify/i);
    expect(mail.html).toContain(url);
    expect(mail.html).toContain('Verify email');
    expect(mail.text).toContain(url);
    expect(mail.text).toMatch(/recovery phrase/i);
    expect(mail.html).toMatch(/private keys/i);
    expect(mail.html).not.toMatch(/seed phrase.*enter/i);
  });

  it('builds password reset email with expiry guidance', () => {
    const url = 'https://auvorawallet.com/auth/reset-password?token=xyz';
    const mail = buildPasswordResetEmail(url);
    expect(mail.subject).toMatch(/Reset/i);
    expect(mail.html).toContain(url);
    expect(mail.text).toMatch(/1 hour/i);
    expect(mail.text).toMatch(/recovery phrase/i);
  });

  it('builds security notices without wallet secrets', () => {
    const notices = [
      buildEmailVerifiedNotice(),
      buildPasswordChangedNotice(),
      buildSessionRevokedNotice(),
      buildNewLoginNotice({ deviceName: 'Pixel', platform: 'android', ipAddress: '1.2.3.4' }),
    ];
    for (const mail of notices) {
      expect(mail.html).toBeTruthy();
      expect(mail.text).toBeTruthy();
      expect(mail.text.toLowerCase()).not.toContain('mnemonic');
      expect(mail.text).toMatch(/never ask for your recovery phrase/i);
      expect(mail.html.toLowerCase()).not.toMatch(/0x[a-f0-9]{40}/);
      expect(mail.text.toLowerCase()).not.toContain('enter your seed');
    }
    expect(buildNewLoginNotice({ deviceName: 'Pixel', ipAddress: '1.2.3.4' }).text).toContain(
      'Pixel',
    );
  });

  it('redacts tokens from console mail logs', () => {
    const raw = 'Verify: https://auvorawallet.com/auth/verify-email?token=super-secret-token&x=1';
    expect(redactMailLogBody(raw)).toContain('token=[redacted]');
    expect(redactMailLogBody(raw)).not.toContain('super-secret-token');
  });
});
