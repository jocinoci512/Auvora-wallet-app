import type { ChainNetwork, Prisma } from '@auvora/database';

export const EVENT_LOG_REPOSITORY = Symbol('EVENT_LOG_REPOSITORY');

export interface EventLogRecord {
  id: string;
  eventType: string;
  chain: ChainNetwork | null;
  aggregateId: string | null;
  payload: Prisma.JsonValue;
  correlationId: string | null;
  createdAt: Date;
}

export interface EventLogFilters {
  chain?: ChainNetwork;
  eventType?: string;
  skip?: number;
  take?: number;
}

export interface EventLogRepositoryPort {
  list(filters: EventLogFilters): Promise<{ items: EventLogRecord[]; total: number }>;
}
