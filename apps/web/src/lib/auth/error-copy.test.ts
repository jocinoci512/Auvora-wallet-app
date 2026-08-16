import { classifyAuthError, humanizeAuthError, isStrongPassword } from './error-copy';

describe('auth error copy', () => {
  it('never returns raw JSON or developer mail-driver notes', () => {
    expect(humanizeAuthError({ message: '{"code":"AUTH"}' })).not.toMatch(/\{/);
    expect(humanizeAuthError(new Error('409 email already exists'))).toMatch(/already exists/i);
    expect(humanizeAuthError(new Error('429 rate limit'))).toMatch(/too many/i);
    expect(classifyAuthError('account locked')).toBe('locked');
    expect(classifyAuthError('account suspended')).toBe('suspended');
  });

  it('enforces password complexity without leaking rules as backend JSON', () => {
    expect(isStrongPassword('short')).toBe(false);
    expect(isStrongPassword('CorrectHorse1!abc')).toBe(true);
  });
});
