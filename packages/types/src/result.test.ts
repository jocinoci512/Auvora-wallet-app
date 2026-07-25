import { err, isErr, isOk, ok } from './index';

describe('Result helpers', () => {
  it('creates successful results', () => {
    const result = ok(42);
    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(result.value).toBe(42);
    }
  });

  it('creates error results', () => {
    const result = err(new Error('boom'));
    expect(isErr(result)).toBe(true);
    if (isErr(result)) {
      expect(result.error.message).toBe('boom');
    }
  });
});
