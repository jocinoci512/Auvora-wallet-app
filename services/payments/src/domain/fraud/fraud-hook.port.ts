import type { PaymentType } from '@auvora/database';

export const FRAUD_HOOK = Symbol('FRAUD_HOOK');

export interface FraudCheckInput {
  paymentId: string;
  ownerUserId: string;
  paymentType: PaymentType;
  amount: string;
  currency: string;
  metadata?: Record<string, unknown>;
}

export interface FraudCheckResult {
  allow: boolean;
  riskScore?: number;
  reasons?: string[];
}

/**
 * Extension point for fraud/AML screening. The default adapter always allows
 * the payment; a real implementation would call an external risk engine.
 */
export interface FraudHookPort {
  checkPayment(input: FraudCheckInput): Promise<FraudCheckResult>;
}
