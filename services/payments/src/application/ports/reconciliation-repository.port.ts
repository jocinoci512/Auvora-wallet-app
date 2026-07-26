import type { Prisma, ReconciliationStatus } from '@auvora/database';

export const RECONCILIATION_REPOSITORY = Symbol('RECONCILIATION_REPOSITORY');

export interface ReconciliationRecord {
  id: string;
  paymentId: string | null;
  settlementId: string | null;
  status: ReconciliationStatus;
  source: string;
  expectedAmount: string | null;
  actualAmount: string | null;
  currency: string | null;
  mismatchReason: string | null;
  requiresManualReview: boolean;
  resolvedAt: Date | null;
  resolvedBy: string | null;
  metadata: Prisma.JsonValue | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateReconciliationData {
  paymentId?: string | null;
  settlementId?: string | null;
  status?: ReconciliationStatus;
  source: string;
  expectedAmount?: string | null;
  actualAmount?: string | null;
  currency?: string | null;
  mismatchReason?: string | null;
  requiresManualReview?: boolean;
  metadata?: Prisma.InputJsonValue;
}

export interface UpdateReconciliationData {
  status?: ReconciliationStatus;
  mismatchReason?: string | null;
  requiresManualReview?: boolean;
  resolvedAt?: Date | null;
  resolvedBy?: string | null;
  metadata?: Prisma.InputJsonValue;
}

export interface ReconciliationFilters {
  status?: ReconciliationStatus;
  requiresManualReview?: boolean;
  paymentId?: string;
  skip?: number;
  take?: number;
}

export interface ReconciliationRepositoryPort {
  create(data: CreateReconciliationData): Promise<ReconciliationRecord>;
  findById(id: string): Promise<ReconciliationRecord | null>;
  list(filters: ReconciliationFilters): Promise<{ items: ReconciliationRecord[]; total: number }>;
  update(id: string, data: UpdateReconciliationData): Promise<ReconciliationRecord>;
}
