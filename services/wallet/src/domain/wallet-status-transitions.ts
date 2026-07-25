import { WalletStatus } from '@auvora/database';
import { InvalidStatusTransitionError } from './errors';

const ALLOWED_TRANSITIONS: Record<WalletStatus, readonly WalletStatus[]> = {
  [WalletStatus.PENDING]: [WalletStatus.ACTIVE],
  [WalletStatus.ACTIVE]: [WalletStatus.SUSPENDED, WalletStatus.ARCHIVED],
  [WalletStatus.SUSPENDED]: [WalletStatus.ACTIVE, WalletStatus.ARCHIVED],
  [WalletStatus.ARCHIVED]: [WalletStatus.ACTIVE],
};

export function assertStatusTransition(from: WalletStatus, to: WalletStatus): void {
  const allowed = ALLOWED_TRANSITIONS[from];
  if (!allowed.includes(to)) {
    throw new InvalidStatusTransitionError(
      `Cannot transition wallet from ${from} to ${to}`,
    );
  }
}

export function canTransition(from: WalletStatus, to: WalletStatus): boolean {
  return ALLOWED_TRANSITIONS[from].includes(to);
}
