import { maskSensitiveString, maskSensitiveValue } from './log-masking';

describe('log-masking', () => {
  it('masks emails, bearer tokens, and card-like numbers', () => {
    const masked = maskSensitiveString(
      'user a@b.com Bearer abc.def password=secret 4111111111111111',
    );
    expect(masked).toContain('[REDACTED_EMAIL]');
    expect(masked).toContain('Bearer [REDACTED_TOKEN]');
    expect(masked).toContain('[REDACTED_CARD]');
  });

  it('redacts sensitive object keys', () => {
    expect(maskSensitiveValue({ password: 'x', nested: { apiKey: 'y', ok: 1 } })).toEqual({
      password: '[REDACTED]',
      nested: { apiKey: '[REDACTED]', ok: 1 },
    });
  });
});
