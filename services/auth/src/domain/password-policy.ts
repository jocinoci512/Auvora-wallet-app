import { ValidationError } from './errors';

const MIN_LENGTH = 12;
const UPPER = /[A-Z]/;
const LOWER = /[a-z]/;
const DIGIT = /[0-9]/;
const SPECIAL = /[^A-Za-z0-9]/;

export interface PasswordValidationResult {
  valid: boolean;
  errors: string[];
}

export function validatePassword(password: string): PasswordValidationResult {
  const errors: string[] = [];

  if (password.length < MIN_LENGTH) {
    errors.push(`Password must be at least ${MIN_LENGTH} characters`);
  }
  if (!UPPER.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }
  if (!LOWER.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }
  if (!DIGIT.test(password)) {
    errors.push('Password must contain at least one digit');
  }
  if (!SPECIAL.test(password)) {
    errors.push('Password must contain at least one special character');
  }

  return { valid: errors.length === 0, errors };
}

export function assertPasswordPolicy(password: string): void {
  const result = validatePassword(password);
  if (!result.valid) {
    throw new ValidationError(result.errors.join('; '));
  }
}
