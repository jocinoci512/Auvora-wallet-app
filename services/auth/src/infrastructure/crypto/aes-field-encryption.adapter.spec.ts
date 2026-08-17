import { generateTotpSecret } from '../../domain/totp';
import { AesFieldEncryptionAdapter } from './aes-field-encryption.adapter';

describe('AES field encryption', () => {
  const adapter = new AesFieldEncryptionAdapter({
    AUTH_FIELD_ENCRYPTION_KEY: 'k'.repeat(32),
  } as never);

  it('encrypts and decrypts TOTP secrets', () => {
    const secret = generateTotpSecret();
    const cipher = adapter.encrypt(secret);
    expect(cipher.startsWith('v1:')).toBe(true);
    expect(cipher).not.toContain(secret);
    expect(adapter.decrypt(cipher)).toBe(secret);
  });
});
