import { Inject, Injectable } from '@nestjs/common';
import {
  CHAIN_BLOCK_REPOSITORY,
  type ChainBlockFilters,
  type ChainBlockRecord,
  type ChainBlockRepositoryPort,
} from '../ports/chain-block-repository.port';
import {
  EVENT_LOG_REPOSITORY,
  type EventLogFilters,
  type EventLogRecord,
  type EventLogRepositoryPort,
} from '../ports/event-log-repository.port';
import {
  PROVIDER_HEALTH_REPOSITORY,
  type ProviderHealthFilters,
  type ProviderHealthRecord,
  type ProviderHealthRepositoryPort,
} from '../ports/provider-health-repository.port';
import {
  PROVIDER_RECORD_REPOSITORY,
  type ProviderRecord,
  type ProviderRecordRepositoryPort,
} from '../ports/provider-record-repository.port';
import {
  SYNC_JOB_REPOSITORY,
  type SyncJobFilters,
  type SyncJobRecord,
  type SyncJobRepositoryPort,
} from '../ports/sync-job-repository.port';

/**
 * Read-only aggregation service backing the admin dashboard endpoints
 * (providers, health, sync jobs, blocks, events).
 */
@Injectable()
export class AdminQueryService {
  constructor(
    @Inject(PROVIDER_RECORD_REPOSITORY) private readonly providers: ProviderRecordRepositoryPort,
    @Inject(PROVIDER_HEALTH_REPOSITORY) private readonly health: ProviderHealthRepositoryPort,
    @Inject(SYNC_JOB_REPOSITORY) private readonly syncJobs: SyncJobRepositoryPort,
    @Inject(CHAIN_BLOCK_REPOSITORY) private readonly blocks: ChainBlockRepositoryPort,
    @Inject(EVENT_LOG_REPOSITORY) private readonly events: EventLogRepositoryPort,
  ) {}

  listProviders(): Promise<ProviderRecord[]> {
    return this.providers.listAll();
  }

  listHealth(filters: ProviderHealthFilters): Promise<{ items: ProviderHealthRecord[]; total: number }> {
    return this.health.list(filters);
  }

  listSyncJobs(filters: SyncJobFilters): Promise<{ items: SyncJobRecord[]; total: number }> {
    return this.syncJobs.list(filters);
  }

  listBlocks(filters: ChainBlockFilters): Promise<{ items: ChainBlockRecord[]; total: number }> {
    return this.blocks.list(filters);
  }

  listEvents(filters: EventLogFilters): Promise<{ items: EventLogRecord[]; total: number }> {
    return this.events.list(filters);
  }
}
