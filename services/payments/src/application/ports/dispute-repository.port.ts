import type { DisputeStatus, Prisma } from '@auvora/database';

export const DISPUTE_REPOSITORY = Symbol('DISPUTE_REPOSITORY');

export interface DisputeRecord {
  id: string;
  paymentId: string;
  status: DisputeStatus;
  reason: string | null;
  amount: string | null;
  currency: string | null;
  metadata: Prisma.JsonValue | null;
  openedAt: Date;
  closedAt: Date | null;
  updatedAt: Date;
}

export interface CreateDisputeData {
  paymentId: string;
  reason?: string | null;
  amount?: string | null;
  currency?: string | null;
  metadata?: Prisma.InputJsonValue;
}

export interface UpdateDisputeData {
  status?: DisputeStatus;
  closedAt?: Date | null;
}

export interface DisputeFilters {
  paymentId?: string;
  status?: DisputeStatus;
  skip?: number;
  take?: number;
}

export interface DisputeRepositoryPort {
  create(data: CreateDisputeData): Promise<DisputeRecord>;
  findById(id: string): Promise<DisputeRecord | null>;
  list(filters: DisputeFilters): Promise<{ items: DisputeRecord[]; total: number }>;
  update(id: string, data: UpdateDisputeData): Promise<DisputeRecord>;
}
