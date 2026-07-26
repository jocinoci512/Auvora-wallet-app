import type { ChargebackStatus, Prisma } from '@auvora/database';

export const CHARGEBACK_REPOSITORY = Symbol('CHARGEBACK_REPOSITORY');

export interface ChargebackRecord {
  id: string;
  paymentId: string;
  status: ChargebackStatus;
  amount: string;
  currency: string;
  reason: string | null;
  providerRef: string | null;
  metadata: Prisma.JsonValue | null;
  openedAt: Date;
  closedAt: Date | null;
  updatedAt: Date;
}

export interface CreateChargebackData {
  paymentId: string;
  amount: string;
  currency: string;
  reason?: string | null;
  providerRef?: string | null;
  metadata?: Prisma.InputJsonValue;
}

export interface UpdateChargebackData {
  status?: ChargebackStatus;
  closedAt?: Date | null;
}

export interface ChargebackFilters {
  paymentId?: string;
  status?: ChargebackStatus;
  skip?: number;
  take?: number;
}

export interface ChargebackRepositoryPort {
  create(data: CreateChargebackData): Promise<ChargebackRecord>;
  findById(id: string): Promise<ChargebackRecord | null>;
  list(filters: ChargebackFilters): Promise<{ items: ChargebackRecord[]; total: number }>;
  update(id: string, data: UpdateChargebackData): Promise<ChargebackRecord>;
}
