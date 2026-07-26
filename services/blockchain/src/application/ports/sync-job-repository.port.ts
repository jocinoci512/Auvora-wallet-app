import type { ChainNetwork, Prisma, SyncJobStatus, SyncJobType } from '@auvora/database';

export const SYNC_JOB_REPOSITORY = Symbol('SYNC_JOB_REPOSITORY');

export interface SyncJobRecord {
  id: string;
  chain: ChainNetwork;
  networkId: string;
  type: SyncJobType;
  status: SyncJobStatus;
  cursor: string | null;
  attempts: number;
  maxAttempts: number;
  lastError: string | null;
  scheduledAt: Date;
  startedAt: Date | null;
  finishedAt: Date | null;
  metadata: Prisma.JsonValue | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateSyncJobData {
  chain: ChainNetwork;
  networkId: string;
  type: SyncJobType;
  cursor?: string;
  metadata?: Prisma.InputJsonValue;
}

export interface SyncJobFilters {
  chain?: ChainNetwork;
  status?: SyncJobStatus;
  type?: SyncJobType;
  skip?: number;
  take?: number;
}

export interface SyncJobRepositoryPort {
  create(data: CreateSyncJobData): Promise<SyncJobRecord>;
  findQueued(limit: number): Promise<SyncJobRecord[]>;
  findRetryable(limit: number): Promise<SyncJobRecord[]>;
  markRunning(id: string): Promise<SyncJobRecord>;
  markSucceeded(id: string): Promise<SyncJobRecord>;
  markFailed(id: string, error: string): Promise<SyncJobRecord>;
  markRetrying(id: string, error: string): Promise<SyncJobRecord>;
  list(filters: SyncJobFilters): Promise<{ items: SyncJobRecord[]; total: number }>;
}
