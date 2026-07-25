import { Argon2PasswordHasherAdapter } from './argon2-password-hasher.adapter';

describe('Argon2PasswordHasherAdapter', () => {
  const hasher = new Argon2PasswordHasherAdapter();

  it(
    'hashes and verifies passwords',
    async () => {
      const hash = await hasher.hash('SecurePass1!');
      expect(hash).not.toBe('SecurePass1!');
      await expect(hasher.verify('SecurePass1!', hash)).resolves.toBe(true);
      await expect(hasher.verify('WrongPass1!', hash)).resolves.toBe(false);
    },
    30_000,
  );
});
