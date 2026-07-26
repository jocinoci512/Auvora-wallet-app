import type { Prisma, SettlementMode, SettlementStatus } from '@auvora/database';

export const SETTLEMENT_REPOSITORY = Symbol('SETTLEMENT_REPOSITORY');
export const SETTLEMENT_BATCH_REPOSITORY = Symbol('SETTLEMENT_BATCH_REPOSITORY');

export interface SettlementRecord {
  id: string;
  batchId: string | null;
  paymentId: string;
  mode: SettlementMode;
  status: SettlementStatus;
  amount: string;
  currency: string;
  reference: string;
  auditTrail: Prisma.JsonValue | null;
  startedAt: Date | null;
  completedAt: Date | null;
  failedAt: Date | null;
  failureReason: string | null;
  metadata: Prisma.JsonValue | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateSettlementData {
  batchId?: string | null;
  paymentId: string;
  mode: SettlementMode;
  amount: string;
  currency: string;
  reference: string;
  metadata?: Prisma.InputJsonValue;
}

export interface UpdateSettlementData {
  status?: SettlementStatus;
  auditTrail?: Prisma.InputJsonValue;
  startedAt?: Date | null;
  completedAt?: Date | null;
  failedAt?: Date | null;
  failureReason?: string | null;
}

export interface SettlementFilters {
  batchId?: string;
  paymentId?: string;
  status?: SettlementStatus;
  skip?: number;
  take?: number;
}

export interface SettlementRepositoryPort {
  create(data: CreateSettlementData): Promise<SettlementRecord>;
  findById(id: string): Promise<SettlementRecord | null>;
  list(filters: SettlementFilters): Promise<{ items: SettlementRecord[]; total: number }>;
  update(id: string, data: UpdateSettlementData): Promise<SettlementRecord>;
}

export interface SettlementBatchRecord {
  id: string;
  reference: string;
  mode: SettlementMode;
  status: SettlementStatus;
  currency: string;
  totalAmount: string;
  paymentCount: number;
  scheduledAt: Date | null;
  startedAt: Date | null;
  completedAt: Date | null;
  failedAt: Date | null;
  failureReason: string | null;
  report: Prisma.JsonValue | null;
  metadata: Prisma.JsonValue | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateSettlementBatchData {
  reference: string;
  mode: SettlementMode;
  currency: string;
  totalAmount?: string;
  paymentCount?: number;
  scheduledAt?: Date | null;
  metadata?: Prisma.InputJsonValue;
}

export interface UpdateSettlementBatchData {
  status?: SettlementStatus;
  totalAmount?: string;
  paymentCount?: number;
  startedAt?: Date | null;
  completedAt?: Date | null;
  failedAt?: Date | null;
  failureReason?: string | null;
  report?: Prisma.InputJsonValue;
}

export interface SettlementBatchFilters {
  status?: SettlementStatus;
  mode?: SettlementMode;
  skip?: number;
  take?: number;
}

export interface SettlementBatchRepositoryPort {
  create(data: CreateSettlementBatchData): Promise<SettlementBatchRecord>;
  findById(id: string): Promise<SettlementBatchRecord | null>;
  list(filters: SettlementBatchFilters): Promise<{ items: SettlementBatchRecord[]; total: number }>;
  update(id: string, data: UpdateSettlementBatchData): Promise<SettlementBatchRecord>;
}
