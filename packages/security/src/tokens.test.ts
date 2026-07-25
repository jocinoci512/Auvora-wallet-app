import { generateOpaqueToken, hashToken } from './index';

describe('token utilities', () => {
  it('hashes tokens deterministically with sha256 hex', () => {
    expect(hashToken('secret-value')).toBe(hashToken('secret-value'));
    expect(hashToken('secret-value')).toMatch(/^[a-f0-9]{64}$/);
  });

  it('generates opaque url-safe tokens', () => {
    const token = generateOpaqueToken();
    expect(token.length).toBeGreaterThan(20);
    expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
  });
});
