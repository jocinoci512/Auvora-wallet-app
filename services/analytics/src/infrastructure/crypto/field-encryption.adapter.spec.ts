import { AesFieldEncryptionAdapter } from './field-encryption.adapter';

describe('AesFieldEncryptionAdapter', () => {
  const env = {
    ANALYTICS_FIELD_ENCRYPTION_KEY: 'test-analytics-field-encryption-key-32',
  };

  it('encrypts and decrypts round-trip', () => {
    const adapter = new AesFieldEncryptionAdapter(env as never);
    const encrypted = adapter.encrypt('secret report payload');
    expect(encrypted.startsWith('v1:')).toBe(true);
    expect(adapter.decrypt(encrypted)).toBe('secret report payload');
  });

  it('hashes deterministically', () => {
    const adapter = new AesFieldEncryptionAdapter(env as never);
    expect(adapter.hash('same')).toBe(adapter.hash('same'));
    expect(adapter.hash('same')).not.toBe(adapter.hash('different'));
  });

  it('rejects invalid ciphertext format', () => {
    const adapter = new AesFieldEncryptionAdapter(env as never);
    expect(() => adapter.decrypt('bad')).toThrow('Invalid ciphertext format');
  });
});
