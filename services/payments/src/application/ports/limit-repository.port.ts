import type { LimitWindow, Prisma } from '@auvora/database';

export const LIMIT_REPOSITORY = Symbol('LIMIT_REPOSITORY');

export interface PaymentLimitRecord {
  id: string;
  window: LimitWindow;
  amount: string;
  currency: string | null;
  assetCode: string | null;
  ownerUserId: string | null;
  accountTier: string | null;
  country: string | null;
  riskProfile: string | null;
  isEnabled: boolean;
  metadata: Prisma.JsonValue | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreatePaymentLimitData {
  window: LimitWindow;
  amount: string;
  currency?: string | null;
  assetCode?: string | null;
  ownerUserId?: string | null;
  accountTier?: string | null;
  country?: string | null;
  riskProfile?: string | null;
  isEnabled?: boolean;
  metadata?: Prisma.InputJsonValue;
}

export interface UpdatePaymentLimitData {
  amount?: string;
  isEnabled?: boolean;
  metadata?: Prisma.InputJsonValue;
}

export interface PaymentLimitFilters {
  ownerUserId?: string;
  accountTier?: string;
  country?: string;
  riskProfile?: string;
  window?: LimitWindow;
  skip?: number;
  take?: number;
}

export interface LimitRepositoryPort {
  create(data: CreatePaymentLimitData): Promise<PaymentLimitRecord>;
  findById(id: string): Promise<PaymentLimitRecord | null>;
  list(filters: PaymentLimitFilters): Promise<{ items: PaymentLimitRecord[]; total: number }>;
  findApplicable(criteria: {
    ownerUserId: string;
    accountTier?: string | null;
    country?: string | null;
    riskProfile?: string | null;
  }): Promise<PaymentLimitRecord[]>;
  update(id: string, data: UpdatePaymentLimitData): Promise<PaymentLimitRecord>;
}
