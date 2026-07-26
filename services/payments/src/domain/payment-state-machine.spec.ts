import { PaymentStatus } from '@auvora/database';
import { InvalidStatusTransitionError } from './errors';
import {
  assertTransition,
  canTransition,
  getAllowedTransitions,
  isTerminalPaymentStatus,
} from './payment-state-machine';

describe('payment-state-machine', () => {
  it('allows the documented happy-path transitions', () => {
    expect(canTransition(PaymentStatus.CREATED, PaymentStatus.PENDING)).toBe(true);
    expect(canTransition(PaymentStatus.PENDING, PaymentStatus.AUTHORIZED)).toBe(true);
    expect(canTransition(PaymentStatus.AUTHORIZED, PaymentStatus.PROCESSING)).toBe(true);
    expect(canTransition(PaymentStatus.PROCESSING, PaymentStatus.COMPLETED)).toBe(true);
    expect(canTransition(PaymentStatus.PROCESSING, PaymentStatus.SETTLED)).toBe(true);
    expect(canTransition(PaymentStatus.SETTLED, PaymentStatus.COMPLETED)).toBe(true);
    expect(canTransition(PaymentStatus.COMPLETED, PaymentStatus.REFUNDED)).toBe(true);
    expect(canTransition(PaymentStatus.DISPUTED, PaymentStatus.CHARGEBACK)).toBe(true);
  });

  it('rejects transitions not present in the allowed map', () => {
    expect(canTransition(PaymentStatus.CREATED, PaymentStatus.COMPLETED)).toBe(false);
    expect(canTransition(PaymentStatus.PENDING, PaymentStatus.REFUNDED)).toBe(false);
    expect(canTransition(PaymentStatus.COMPLETED, PaymentStatus.PENDING)).toBe(false);
  });

  it('rejects a no-op transition to the same status', () => {
    expect(canTransition(PaymentStatus.PENDING, PaymentStatus.PENDING)).toBe(false);
  });

  it.each([
    PaymentStatus.CANCELLED,
    PaymentStatus.FAILED,
    PaymentStatus.EXPIRED,
    PaymentStatus.REFUNDED,
    PaymentStatus.REVERSED,
    PaymentStatus.CHARGEBACK,
  ])('treats %s as terminal with no further transitions', (status) => {
    expect(isTerminalPaymentStatus(status)).toBe(true);
    expect(getAllowedTransitions(status)).toHaveLength(0);
    expect(canTransition(status, PaymentStatus.PENDING)).toBe(false);
  });

  it('does not treat in-flight statuses as terminal', () => {
    expect(isTerminalPaymentStatus(PaymentStatus.PROCESSING)).toBe(false);
    expect(isTerminalPaymentStatus(PaymentStatus.SETTLED)).toBe(false);
  });

  it('assertTransition passes silently for a valid transition', () => {
    expect(() => assertTransition(PaymentStatus.CREATED, PaymentStatus.PENDING)).not.toThrow();
  });

  it('assertTransition throws InvalidStatusTransitionError for an invalid transition', () => {
    expect(() => assertTransition(PaymentStatus.CANCELLED, PaymentStatus.PENDING)).toThrow(
      InvalidStatusTransitionError,
    );
    expect(() => assertTransition(PaymentStatus.CREATED, PaymentStatus.COMPLETED)).toThrow(
      /Cannot transition payment from CREATED to COMPLETED/,
    );
  });
});
