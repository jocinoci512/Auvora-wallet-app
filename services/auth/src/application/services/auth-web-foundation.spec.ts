import { validatePassword } from '../../domain/password-policy';

describe('web auth foundation policies', () => {
  it('requires strong passwords (>=12 with classes)', () => {
    expect(validatePassword('short').valid).toBe(false);
    expect(validatePassword('Password123!').valid).toBe(true);
  });
});
