import type { PaymentStatus, Prisma } from '@auvora/database';

export const REFUND_REPOSITORY = Symbol('REFUND_REPOSITORY');

export interface RefundRecord {
  id: string;
  paymentId: string;
  amount: string;
  currency: string;
  status: PaymentStatus;
  reason: string | null;
  providerRef: string | null;
  metadata: Prisma.JsonValue | null;
  createdAt: Date;
  updatedAt: Date;
  completedAt: Date | null;
}

export interface CreateRefundData {
  paymentId: string;
  amount: string;
  currency: string;
  status?: PaymentStatus;
  reason?: string | null;
  providerRef?: string | null;
  metadata?: Prisma.InputJsonValue;
}

export interface UpdateRefundData {
  status?: PaymentStatus;
  providerRef?: string | null;
  completedAt?: Date | null;
}

export interface RefundFilters {
  paymentId?: string;
  status?: PaymentStatus;
  skip?: number;
  take?: number;
}

export interface RefundRepositoryPort {
  create(data: CreateRefundData): Promise<RefundRecord>;
  findById(id: string): Promise<RefundRecord | null>;
  list(filters: RefundFilters): Promise<{ items: RefundRecord[]; total: number }>;
  update(id: string, data: UpdateRefundData): Promise<RefundRecord>;
}
