import type { PaymentMethodType, Prisma } from '@auvora/database';

export const PAYMENT_METHOD_REPOSITORY = Symbol('PAYMENT_METHOD_REPOSITORY');

export interface PaymentMethodRecord {
  id: string;
  ownerUserId: string;
  type: PaymentMethodType;
  label: string | null;
  isDefault: boolean;
  isActive: boolean;
  last4: string | null;
  country: string | null;
  currency: string | null;
  metadata: Prisma.JsonValue | null;
  createdAt: Date;
  updatedAt: Date;
  archivedAt: Date | null;
}

export interface CreatePaymentMethodData {
  ownerUserId: string;
  type: PaymentMethodType;
  label?: string | null;
  last4?: string | null;
  country?: string | null;
  currency?: string | null;
  isDefault?: boolean;
  metadata?: Prisma.InputJsonValue;
}

export interface UpdatePaymentMethodData {
  label?: string | null;
  isDefault?: boolean;
  isActive?: boolean;
  metadata?: Prisma.InputJsonValue;
  archivedAt?: Date | null;
}

export interface PaymentMethodFilters {
  ownerUserId?: string;
  isActive?: boolean;
  skip?: number;
  take?: number;
}

export interface PaymentMethodRepositoryPort {
  create(data: CreatePaymentMethodData): Promise<PaymentMethodRecord>;
  findById(id: string): Promise<PaymentMethodRecord | null>;
  list(filters: PaymentMethodFilters): Promise<{ items: PaymentMethodRecord[]; total: number }>;
  update(id: string, data: UpdatePaymentMethodData): Promise<PaymentMethodRecord>;
  clearDefault(ownerUserId: string): Promise<void>;
}
