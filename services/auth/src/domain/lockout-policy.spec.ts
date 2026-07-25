import {
  shouldLock,
  computeLockedUntil,
  isCurrentlyLocked,
} from '../../src/domain/lockout-policy';

describe('lockout-policy', () => {
  it('shouldLock when failed count reaches max', () => {
    expect(shouldLock(4, 5)).toBe(false);
    expect(shouldLock(5, 5)).toBe(true);
  });

  it('computeLockedUntil adds duration seconds', () => {
    const now = new Date('2026-01-01T00:00:00.000Z');
    const locked = computeLockedUntil(now, 900);
    expect(locked.toISOString()).toBe('2026-01-01T00:15:00.000Z');
  });

  it('isCurrentlyLocked respects lockedUntil', () => {
    const now = new Date('2026-01-01T00:00:00.000Z');
    expect(isCurrentlyLocked(new Date('2026-01-01T00:10:00.000Z'), now)).toBe(true);
    expect(isCurrentlyLocked(new Date('2025-12-31T23:00:00.000Z'), now)).toBe(false);
    expect(isCurrentlyLocked(null, now)).toBe(false);
  });
});
