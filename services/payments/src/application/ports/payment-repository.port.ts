import type { PaymentStatus, PaymentType, Prisma } from '@auvora/database';

export const PAYMENT_REPOSITORY = Symbol('PAYMENT_REPOSITORY');

export interface PaymentRecord {
  id: string;
  reference: string;
  type: PaymentType;
  status: PaymentStatus;
  ownerUserId: string;
  amount: string;
  feeAmount: string;
  currency: string;
  assetCode: string | null;
  fromWalletId: string | null;
  toWalletId: string | null;
  paymentMethodId: string | null;
  providerId: string | null;
  providerRef: string | null;
  idempotencyKey: string | null;
  correlationId: string | null;
  walletTransactionId: string | null;
  chainTxId: string | null;
  country: string | null;
  accountTier: string | null;
  riskProfile: string | null;
  riskFlags: string[];
  description: string | null;
  failureReason: string | null;
  scheduledAt: Date | null;
  authorizedAt: Date | null;
  settledAt: Date | null;
  completedAt: Date | null;
  cancelledAt: Date | null;
  expiresAt: Date | null;
  metadata: Prisma.JsonValue | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreatePaymentData {
  reference: string;
  type: PaymentType;
  status?: PaymentStatus;
  ownerUserId: string;
  amount: string;
  feeAmount?: string;
  currency: string;
  assetCode?: string | null;
  fromWalletId?: string | null;
  toWalletId?: string | null;
  paymentMethodId?: string | null;
  providerId?: string | null;
  idempotencyKey?: string | null;
  correlationId?: string | null;
  country?: string | null;
  accountTier?: string | null;
  riskProfile?: string | null;
  description?: string | null;
  scheduledAt?: Date | null;
  expiresAt?: Date | null;
  metadata?: Prisma.InputJsonValue;
}

export interface UpdatePaymentData {
  status?: PaymentStatus;
  providerId?: string | null;
  providerRef?: string | null;
  walletTransactionId?: string | null;
  chainTxId?: string | null;
  failureReason?: string | null;
  riskFlags?: string[];
  feeAmount?: string;
  authorizedAt?: Date | null;
  settledAt?: Date | null;
  completedAt?: Date | null;
  cancelledAt?: Date | null;
  metadata?: Prisma.InputJsonValue;
}

export interface PaymentFilters {
  ownerUserId?: string;
  status?: PaymentStatus;
  statuses?: PaymentStatus[];
  type?: PaymentType;
  currency?: string;
  skip?: number;
  take?: number;
}

export interface PaymentRepositoryPort {
  create(data: CreatePaymentData): Promise<PaymentRecord>;
  findById(id: string): Promise<PaymentRecord | null>;
  findByReference(reference: string): Promise<PaymentRecord | null>;
  findByIdempotencyKey(key: string): Promise<PaymentRecord | null>;
  list(filters: PaymentFilters): Promise<{ items: PaymentRecord[]; total: number }>;
  update(id: string, data: UpdatePaymentData): Promise<PaymentRecord>;
  sumAmountSince(
    ownerUserId: string,
    since: Date,
    excludeStatuses?: PaymentStatus[],
  ): Promise<{ count: number; total: string }>;
  findSettlable(mode: 'INSTANT' | 'BATCH', take: number): Promise<PaymentRecord[]>;
}
