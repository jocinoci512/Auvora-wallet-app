import { Inject, Injectable } from '@nestjs/common';
import { ChainTxStatus, SyncJobStatus } from '@auvora/database';
import {
  CHAIN_ADDRESS_REPOSITORY,
  type ChainAddressRepositoryPort,
} from '../ports/chain-address-repository.port';
import {
  CHAIN_TRANSACTION_REPOSITORY,
  type ChainTransactionRepositoryPort,
} from '../ports/chain-transaction-repository.port';
import { PROVIDER_FACTORY, type ProviderFactoryPort } from '../ports/provider-factory.port';
import {
  PROVIDER_HEALTH_REPOSITORY,
  type ProviderHealthRecord,
  type ProviderHealthRepositoryPort,
} from '../ports/provider-health-repository.port';
import { SYNC_JOB_REPOSITORY, type SyncJobRepositoryPort } from '../ports/sync-job-repository.port';

export interface BlockchainMetrics {
  supportedChains: number;
  totalAddresses: number;
  pendingTransactions: number;
  confirmedTransactions: number;
  failedTransactions: number;
  queuedSyncJobs: number;
  runningSyncJobs: number;
  providerHealth: ProviderHealthRecord[];
}

@Injectable()
export class AdminMetricsService {
  constructor(
    @Inject(CHAIN_ADDRESS_REPOSITORY) private readonly addresses: ChainAddressRepositoryPort,
    @Inject(CHAIN_TRANSACTION_REPOSITORY) private readonly transactions: ChainTransactionRepositoryPort,
    @Inject(SYNC_JOB_REPOSITORY) private readonly syncJobs: SyncJobRepositoryPort,
    @Inject(PROVIDER_HEALTH_REPOSITORY) private readonly providerHealth: ProviderHealthRepositoryPort,
    @Inject(PROVIDER_FACTORY) private readonly providerFactory: ProviderFactoryPort,
  ) {}

  async getMetrics(): Promise<BlockchainMetrics> {
    const [
      { total: totalAddresses },
      { total: pendingTransactions },
      { total: confirmedTransactions },
      { total: failedTransactions },
      { total: queuedSyncJobs },
      { total: runningSyncJobs },
      providerHealth,
    ] = await Promise.all([
      this.addresses.list({ take: 1 }),
      this.transactions.list({ statuses: [ChainTxStatus.MEMPOOL, ChainTxStatus.PENDING], take: 1 }),
      this.transactions.list({ status: ChainTxStatus.CONFIRMED, take: 1 }),
      this.transactions.list({ status: ChainTxStatus.FAILED, take: 1 }),
      this.syncJobs.list({ status: SyncJobStatus.QUEUED, take: 1 }),
      this.syncJobs.list({ status: SyncJobStatus.RUNNING, take: 1 }),
      this.providerHealth.latestByChain(),
    ]);

    return {
      supportedChains: this.providerFactory.getSupportedChains().length,
      totalAddresses,
      pendingTransactions,
      confirmedTransactions,
      failedTransactions,
      queuedSyncJobs,
      runningSyncJobs,
      providerHealth,
    };
  }
}
