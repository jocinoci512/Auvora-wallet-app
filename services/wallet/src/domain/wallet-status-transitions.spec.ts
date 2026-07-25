import { WalletStatus } from '@auvora/database';
import { InvalidStatusTransitionError } from './errors';
import { assertStatusTransition, canTransition } from './wallet-status-transitions';

describe('wallet status transitions', () => {
  it('allows PENDING to ACTIVE', () => {
    expect(canTransition(WalletStatus.PENDING, WalletStatus.ACTIVE)).toBe(true);
    expect(() => assertStatusTransition(WalletStatus.PENDING, WalletStatus.ACTIVE)).not.toThrow();
  });

  it('allows ACTIVE to SUSPENDED and ARCHIVED', () => {
    expect(canTransition(WalletStatus.ACTIVE, WalletStatus.SUSPENDED)).toBe(true);
    expect(canTransition(WalletStatus.ACTIVE, WalletStatus.ARCHIVED)).toBe(true);
  });

  it('allows SUSPENDED to ACTIVE and ARCHIVED', () => {
    expect(canTransition(WalletStatus.SUSPENDED, WalletStatus.ACTIVE)).toBe(true);
    expect(canTransition(WalletStatus.SUSPENDED, WalletStatus.ARCHIVED)).toBe(true);
  });

  it('allows ARCHIVED to ACTIVE (restore)', () => {
    expect(canTransition(WalletStatus.ARCHIVED, WalletStatus.ACTIVE)).toBe(true);
  });

  it('rejects invalid transitions', () => {
    expect(canTransition(WalletStatus.PENDING, WalletStatus.SUSPENDED)).toBe(false);
    expect(canTransition(WalletStatus.ARCHIVED, WalletStatus.SUSPENDED)).toBe(false);

    expect(() => assertStatusTransition(WalletStatus.PENDING, WalletStatus.SUSPENDED)).toThrow(
      InvalidStatusTransitionError,
    );
  });
});
