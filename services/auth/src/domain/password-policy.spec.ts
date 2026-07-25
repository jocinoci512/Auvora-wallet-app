import { validatePassword, assertPasswordPolicy } from '../../src/domain/password-policy';
import { ValidationError } from '../../src/domain/errors';

describe('password-policy', () => {
  it('accepts a strong password', () => {
    const result = validatePassword('SecurePass1!');
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('rejects weak passwords', () => {
    const result = validatePassword('short');
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('throws ValidationError via assertPasswordPolicy', () => {
    expect(() => assertPasswordPolicy('weak')).toThrow(ValidationError);
  });
});
