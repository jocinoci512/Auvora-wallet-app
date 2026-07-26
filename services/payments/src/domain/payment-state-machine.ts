import { PaymentStatus } from '@auvora/database';
import { InvalidStatusTransitionError } from './errors';

/**
 * Allowed forward transitions for a Payment's lifecycle. Any pair not present
 * here (including transitions out of terminal states) is rejected.
 */
const ALLOWED_TRANSITIONS: Record<PaymentStatus, readonly PaymentStatus[]> = {
  [PaymentStatus.CREATED]: [
    PaymentStatus.PENDING,
    PaymentStatus.CANCELLED,
    PaymentStatus.EXPIRED,
    PaymentStatus.FAILED,
  ],
  [PaymentStatus.PENDING]: [
    PaymentStatus.AUTHORIZED,
    PaymentStatus.PROCESSING,
    PaymentStatus.CANCELLED,
    PaymentStatus.FAILED,
    PaymentStatus.EXPIRED,
  ],
  [PaymentStatus.AUTHORIZED]: [PaymentStatus.PROCESSING, PaymentStatus.CANCELLED, PaymentStatus.FAILED],
  [PaymentStatus.PROCESSING]: [
    PaymentStatus.SETTLED,
    PaymentStatus.COMPLETED,
    PaymentStatus.FAILED,
    PaymentStatus.DISPUTED,
  ],
  [PaymentStatus.SETTLED]: [
    PaymentStatus.COMPLETED,
    PaymentStatus.REFUNDED,
    PaymentStatus.REVERSED,
    PaymentStatus.DISPUTED,
    PaymentStatus.CHARGEBACK,
  ],
  [PaymentStatus.COMPLETED]: [
    PaymentStatus.REFUNDED,
    PaymentStatus.REVERSED,
    PaymentStatus.DISPUTED,
    PaymentStatus.CHARGEBACK,
  ],
  [PaymentStatus.DISPUTED]: [PaymentStatus.CHARGEBACK, PaymentStatus.COMPLETED, PaymentStatus.REFUNDED],
  // Terminal states: no further transitions are permitted out of them.
  [PaymentStatus.CANCELLED]: [],
  [PaymentStatus.FAILED]: [],
  [PaymentStatus.EXPIRED]: [],
  [PaymentStatus.REFUNDED]: [],
  [PaymentStatus.REVERSED]: [],
  [PaymentStatus.CHARGEBACK]: [],
};

export const TERMINAL_PAYMENT_STATUSES: readonly PaymentStatus[] = [
  PaymentStatus.CANCELLED,
  PaymentStatus.FAILED,
  PaymentStatus.EXPIRED,
  PaymentStatus.REFUNDED,
  PaymentStatus.REVERSED,
  PaymentStatus.CHARGEBACK,
];

export function isTerminalPaymentStatus(status: PaymentStatus): boolean {
  return TERMINAL_PAYMENT_STATUSES.includes(status);
}

export function canTransition(from: PaymentStatus, to: PaymentStatus): boolean {
  if (from === to) {
    return false;
  }
  return ALLOWED_TRANSITIONS[from]?.includes(to) ?? false;
}

export function getAllowedTransitions(from: PaymentStatus): readonly PaymentStatus[] {
  return ALLOWED_TRANSITIONS[from] ?? [];
}

/** Throws InvalidStatusTransitionError when `to` is not reachable from `from`. */
export function assertTransition(from: PaymentStatus, to: PaymentStatus): void {
  if (!canTransition(from, to)) {
    throw new InvalidStatusTransitionError(
      `Cannot transition payment from ${from} to ${to}`,
    );
  }
}
