import { Inject, Injectable } from '@nestjs/common';
import {
  type ChainNetwork,
  PrismaService,
  type SyncJobStatus,
  type SyncJobType,
} from '@auvora/database';
import type {
  CreateSyncJobData,
  SyncJobFilters,
  SyncJobRecord,
  SyncJobRepositoryPort,
} from '../../application/ports/sync-job-repository.port';

function mapSyncJob(record: {
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
  metadata: unknown;
  createdAt: Date;
  updatedAt: Date;
}): SyncJobRecord {
  return {
    id: record.id,
    chain: record.chain,
    networkId: record.networkId,
    type: record.type,
    status: record.status,
    cursor: record.cursor,
    attempts: record.attempts,
    maxAttempts: record.maxAttempts,
    lastError: record.lastError,
    scheduledAt: record.scheduledAt,
    startedAt: record.startedAt,
    finishedAt: record.finishedAt,
    metadata: record.metadata as SyncJobRecord['metadata'],
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

@Injectable()
export class PrismaSyncJobRepository implements SyncJobRepositoryPort {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async create(data: CreateSyncJobData): Promise<SyncJobRecord> {
    const record = await this.prisma.syncJob.create({
      data: {
        chain: data.chain,
        networkId: data.networkId,
        type: data.type,
        cursor: data.cursor,
        metadata: data.metadata,
      },
    });
    return mapSyncJob(record);
  }

  async findQueued(limit: number): Promise<SyncJobRecord[]> {
    const records = await this.prisma.syncJob.findMany({
      where: { status: 'QUEUED' },
      orderBy: { scheduledAt: 'asc' },
      take: limit,
    });
    return records.map(mapSyncJob);
  }

  async findRetryable(limit: number): Promise<SyncJobRecord[]> {
    const records = await this.prisma.syncJob.findMany({
      where: { status: 'RETRYING' },
      orderBy: { scheduledAt: 'asc' },
      take: limit,
    });
    return records.map(mapSyncJob);
  }

  async markRunning(id: string): Promise<SyncJobRecord> {
    const record = await this.prisma.syncJob.update({
      where: { id },
      data: { status: 'RUNNING', startedAt: new Date(), attempts: { increment: 1 } },
    });
    return mapSyncJob(record);
  }

  async markSucceeded(id: string): Promise<SyncJobRecord> {
    const record = await this.prisma.syncJob.update({
      where: { id },
      data: { status: 'SUCCEEDED', finishedAt: new Date() },
    });
    return mapSyncJob(record);
  }

  async markFailed(id: string, error: string): Promise<SyncJobRecord> {
    const record = await this.prisma.syncJob.update({
      where: { id },
      data: { status: 'FAILED', finishedAt: new Date(), lastError: error },
    });
    return mapSyncJob(record);
  }

  async markRetrying(id: string, error: string): Promise<SyncJobRecord> {
    const record = await this.prisma.syncJob.update({
      where: { id },
      data: { status: 'RETRYING', lastError: error, scheduledAt: new Date(Date.now() + 5000) },
    });
    return mapSyncJob(record);
  }

  async list(filters: SyncJobFilters): Promise<{ items: SyncJobRecord[]; total: number }> {
    const where = {
      ...(filters.chain ? { chain: filters.chain } : {}),
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.type ? { type: filters.type } : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.syncJob.findMany({
        where,
        skip: filters.skip ?? 0,
        take: filters.take ?? 50,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.syncJob.count({ where }),
    ]);
    return { items: items.map(mapSyncJob), total };
  }
}
