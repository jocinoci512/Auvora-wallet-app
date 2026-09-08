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

  it('masks JWTs, private keys, and phone numbers in raw strings', () => {
    const fakeJwt =
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.doNotRealKeySignature';
    const fakeHexKey = '4f3edf983ac636a65a842ce7c78d9aa706d3b113bce9c46f30d7d21715b23b1d';
    const fakePhone = '+1-555-867-5309';

    const input = `Error payload with JWT=${fakeJwt} and key=${fakeHexKey} and phone=${fakePhone}`;
    const masked = maskSensitiveString(input);

    expect(masked).toContain('[REDACTED_JWT]');
    expect(masked).toContain('[REDACTED_KEY]');
    expect(masked).toContain('[REDACTED_PHONE]');
    expect(masked).not.toContain(fakeJwt);
    expect(masked).not.toContain(fakeHexKey);
    expect(masked).not.toContain(fakePhone);
  });

  it('redacts sensitive object keys including passwords, tokens, keys, and KYC data', () => {
    const payload = {
      password: 'fake-password',
      refreshToken: 'fake-refresh-token',
      privateKey: '0x1234567890abcdef',
      mnemonic:
        'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about',
      seedPhrase: 'twelve secret recovery words test only',
      apiKey: 'alch_demo_key_123456789',
      passport: 'base64-passport-image-data',
      selfie: 'base64-selfie-data',
      idNumber: 'G12345678',
      legalName: 'Jane Doe',
      dateOfBirth: '1990-01-01',
      ssn: '000-00-0000',
      safeOperationalStatus: 'KYC_PENDING',
      correlationId: 'corr-safe-uuid',
      nested: {
        credential: 'nested-secret-value',
        ok: 1,
      },
    };

    const redacted = maskSensitiveValue(payload) as Record<string, unknown>;

    expect(redacted.password).toBe('[REDACTED]');
    expect(redacted.refreshToken).toBe('[REDACTED]');
    expect(redacted.privateKey).toBe('[REDACTED]');
    expect(redacted.mnemonic).toBe('[REDACTED]');
    expect(redacted.seedPhrase).toBe('[REDACTED]');
    expect(redacted.apiKey).toBe('[REDACTED]');
    expect(redacted.passport).toBe('[REDACTED]');
    expect(redacted.selfie).toBe('[REDACTED]');
    expect(redacted.idNumber).toBe('[REDACTED]');
    expect(redacted.legalName).toBe('[REDACTED]');
    expect(redacted.dateOfBirth).toBe('[REDACTED]');
    expect(redacted.ssn).toBe('[REDACTED]');
    expect((redacted.nested as Record<string, unknown>).credential).toBe('[REDACTED]');
    // Safe operational metadata preserved
    expect(redacted.safeOperationalStatus).toBe('KYC_PENDING');
    expect(redacted.correlationId).toBe('corr-safe-uuid');
    expect((redacted.nested as Record<string, unknown>).ok).toBe(1);
  });
});
