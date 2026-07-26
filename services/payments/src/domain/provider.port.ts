import type { PaymentType } from '@auvora/database';

export type ProviderOperationStatus = 'SUCCEEDED' | 'PENDING' | 'FAILED';

export interface ProviderOperationResult {
  providerRef: string;
  status: ProviderOperationStatus;
  message?: string;
  metadata?: Record<string, unknown>;
}

export interface AuthorizePaymentInput {
  paymentId: string;
  paymentType: PaymentType;
  amount: string;
  currency: string;
  idempotencyKey: string;
  ownerUserId: string;
  fromWalletId?: string;
  toWalletId?: string;
  metadata?: Record<string, unknown>;
}

export interface CapturePaymentInput {
  paymentId: string;
  providerRef: string;
  amount: string;
  currency: string;
  idempotencyKey: string;
  metadata?: Record<string, unknown>;
}

export interface RefundPaymentInput {
  paymentId: string;
  providerRef: string;
  amount: string;
  currency: string;
  reason?: string;
  idempotencyKey: string;
}

export interface ReversePaymentInput {
  paymentId: string;
  providerRef: string;
  amount: string;
  currency: string;
  reason?: string;
  idempotencyKey: string;
}

export interface EstimateFeeInput {
  paymentType: PaymentType;
  amount: string;
  currency: string;
}

export interface ProviderFeeEstimate {
  amount: string;
  currency: string;
}

export interface ProviderHealthResult {
  healthy: boolean;
  latencyMs: number;
  message?: string;
}

/**
 * Contract implemented by every payment provider (real or simulated).
 * Application services depend only on this port, never on concrete providers.
 */
export interface PaymentProvider {
  getCode(): string;
  getName(): string;
  listCapabilities(): PaymentType[];
  authorize(input: AuthorizePaymentInput): Promise<ProviderOperationResult>;
  capture(input: CapturePaymentInput): Promise<ProviderOperationResult>;
  refund(input: RefundPaymentInput): Promise<ProviderOperationResult>;
  reverse(input: ReversePaymentInput): Promise<ProviderOperationResult>;
  getStatus(providerRef: string): Promise<ProviderOperationResult>;
  estimateFee(input: EstimateFeeInput): Promise<ProviderFeeEstimate>;
  healthCheck(): Promise<ProviderHealthResult>;
}
