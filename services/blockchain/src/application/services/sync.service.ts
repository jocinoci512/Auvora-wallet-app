import {
  Inject,
  Injectable,
  Logger,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';
import { type ChainNetwork, ChainTxStatus, SyncJobType } from '@auvora/database';
import {
  CHAIN_ADDRESS_REPOSITORY,
  type ChainAddressRepositoryPort,
} from '../ports/chain-address-repository.port';
import {
  CHAIN_BLOCK_REPOSITORY,
  type ChainBlockRepositoryPort,
} from '../ports/chain-block-repository.port';
import {
  CHAIN_TRANSACTION_REPOSITORY,
  type ChainTransactionRepositoryPort,
} from '../ports/chain-transaction-repository.port';
import {
  NETWORK_CONFIG_REPOSITORY,
  type NetworkConfigRecord,
  type NetworkConfigRepositoryPort,
} from '../ports/network-config-repository.port';
import { SIMULATOR_LEDGER, type SimulatorLedgerPort } from '../ports/simulator-ledger.port';
import {
  SYNC_JOB_REPOSITORY,
  type SyncJobRecord,
  type SyncJobRepositoryPort,
} from '../ports/sync-job-repository.port';
import { BlockchainEventType, EVENT_BUS, type EventBusPort, NotFoundError } from '../../domain';
import { ENV, type ServiceEnv } from '../../config/env.schema';
import { ConfirmationEngine } from './confirmation-engine.service';

const REORG_CHECK_INTERVAL_TICKS = 20;

@Injectable()
export class SyncService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SyncService.name);
  private timer?: NodeJS.Timeout;
  private tickCount = 0;

  constructor(
    @Inject(NETWORK_CONFIG_REPOSITORY) private readonly networkConfig: NetworkConfigRepositoryPort,
    @Inject(SIMULATOR_LEDGER) private readonly ledger: SimulatorLedgerPort,
    @Inject(CHAIN_BLOCK_REPOSITORY) private readonly blocks: ChainBlockRepositoryPort,
    @Inject(CHAIN_TRANSACTION_REPOSITORY)
    private readonly transactions: ChainTransactionRepositoryPort,
    @Inject(CHAIN_ADDRESS_REPOSITORY) private readonly addresses: ChainAddressRepositoryPort,
    @Inject(SYNC_JOB_REPOSITORY) private readonly syncJobs: SyncJobRepositoryPort,
    @Inject(EVENT_BUS) private readonly eventBus: EventBusPort,
    @Inject(ENV) private readonly env: ServiceEnv,
    @Inject(ConfirmationEngine) private readonly confirmationEngine: ConfirmationEngine,
  ) {}

  onModuleInit(): void {
    const policy = this.getSyncPolicy();
    this.logger.log(
      `Blockchain sync mode=${policy.mode} ledgerSync=${policy.ledgerSyncEnabled} liveProvidersExpected=${policy.liveProvidersExpected}`,
    );
    if (!this.env.BLOCKCHAIN_SIMULATOR_ENABLED) {
      // Live Alchemy tip/health is owned by ProviderRpcHealthService + /health/providers.
      // Simulator ledger block scans stay off until BLOCKCHAIN_SIMULATOR_ENABLED=true.
      return;
    }
    this.timer = setInterval(() => {
      this.tick().catch((error: unknown) => {
        this.logger.error(
          `Sync tick failed: ${error instanceof Error ? error.message : String(error)}`,
        );
      });
    }, this.env.BLOCKCHAIN_SYNC_INTERVAL_MS);
    this.timer.unref();
  }

  /**
   * Surfaces whether background sync is simulator-ledger-backed or live-provider-backed.
   * TransactionEngine may still use the simulator ledger for bookkeeping — this does not
   * imply product services call Alchemy directly.
   */
  getSyncPolicy(): {
    mode: 'live-backed' | 'simulator-only';
    ledgerSyncEnabled: boolean;
    liveProvidersExpected: boolean;
    primaryProvider: string;
  } {
    const liveProvidersExpected =
      this.env.BLOCKCHAIN_PRIMARY_PROVIDER === 'alchemy' &&
      Boolean(
        this.env.ALCHEMY_API_KEY ||
        this.env.ALCHEMY_ETHEREUM_RPC_URL ||
        this.env.ALCHEMY_BSC_RPC_URL ||
        this.env.ALCHEMY_SOLANA_RPC_URL ||
        this.env.ALCHEMY_TRON_RPC_URL ||
        this.env.ALCHEMY_BITCOIN_RPC_URL,
      );
    const ledgerSyncEnabled = this.env.BLOCKCHAIN_SIMULATOR_ENABLED;
    return {
      mode: liveProvidersExpected && !ledgerSyncEnabled ? 'live-backed' : 'simulator-only',
      ledgerSyncEnabled,
      liveProvidersExpected,
      primaryProvider: this.env.BLOCKCHAIN_PRIMARY_PROVIDER,
    };
  }

  onModuleDestroy(): void {
    if (this.timer) {
      clearInterval(this.timer);
    }
  }

  async tick(): Promise<void> {
    this.tickCount += 1;
    const networks = await this.networkConfig.listEnabled();
    for (const network of networks) {
      await this.runBlockScan(network);
    }
    await this.retryFailedJobs();
  }

  async triggerManualSync(chain: ChainNetwork): Promise<SyncJobRecord> {
    const network = await this.networkConfig.findByChain(chain);
    if (!network) {
      throw new NotFoundError(`Unsupported chain ${chain}`);
    }
    return this.runBlockScan(network);
  }

  private async runBlockScan(network: NetworkConfigRecord): Promise<SyncJobRecord> {
    const job = await this.syncJobs.create({
      chain: network.chain,
      networkId: network.id,
      type: SyncJobType.BLOCK_SCAN,
    });
    await this.syncJobs.markRunning(job.id);

    try {
      const previousBlock = await this.blocks.findLatest(network.chain);
      const newHeight = await this.ledger.advanceBlockHeight(network.chain);

      const shouldReorg =
        previousBlock !== null && this.tickCount % REORG_CHECK_INTERVAL_TICKS === 0;
      if (shouldReorg && previousBlock) {
        await this.blocks.markOrphan(previousBlock.id);
        await this.eventBus.publish({
          type: BlockchainEventType.ChainReorganization,
          chain: network.chain,
          payload: { orphanedHeight: previousBlock.height, orphanedHash: previousBlock.hash },
        });
      }

      const hash = this.generateBlockHash(network.chain, newHeight);
      await this.blocks.create({
        chain: network.chain,
        networkId: network.id,
        height: newHeight.toString(),
        hash,
        parentHash: shouldReorg ? null : (previousBlock?.hash ?? null),
        timestamp: new Date(),
      });

      await this.includeMempoolTransactions(network.chain, newHeight);
      await this.confirmationEngine.syncChainConfirmations(network.chain, newHeight);
      await this.processAddressWatchJobs(network);

      await this.eventBus.publish({
        type: BlockchainEventType.BlockSynced,
        chain: network.chain,
        payload: { height: newHeight.toString(), hash },
      });

      return this.syncJobs.markSucceeded(job.id);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'unknown sync error';
      this.logger.error(`Block scan failed for ${network.chain}: ${message}`);
      return this.syncJobs.markFailed(job.id, message);
    }
  }

  private async includeMempoolTransactions(chain: ChainNetwork, newHeight: bigint): Promise<void> {
    const pendingHashes = await this.ledger.listMempool(chain);
    for (const txHash of pendingHashes) {
      const tx = await this.transactions.findByChainTxHash(chain, txHash);
      if (!tx) {
        await this.ledger.removeFromMempool(chain, txHash);
        continue;
      }
      if (tx.blockNumber === null) {
        await this.transactions.updateConfirmations(tx.id, 1, newHeight.toString());
        if (tx.status === ChainTxStatus.MEMPOOL) {
          await this.transactions.updateStatus(tx.id, ChainTxStatus.PENDING);
        }
      }
      await this.ledger.removeFromMempool(chain, txHash);
    }
  }

  private async processAddressWatchJobs(network: NetworkConfigRecord): Promise<void> {
    const job = await this.syncJobs.create({
      chain: network.chain,
      networkId: network.id,
      type: SyncJobType.ADDRESS_WATCH,
    });
    await this.syncJobs.markRunning(job.id);

    try {
      const watched = await this.addresses.listWatched(network.chain);
      for (const address of watched) {
        await this.ledger.watchAddress(network.chain, address.address);
      }
      await this.syncJobs.markSucceeded(job.id);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'address watch failed';
      await this.syncJobs.markFailed(job.id, message);
    }
  }

  private async retryFailedJobs(): Promise<void> {
    const retryable = await this.syncJobs.findRetryable(10);
    for (const job of retryable) {
      if (job.attempts >= job.maxAttempts) {
        await this.syncJobs.markFailed(job.id, 'max attempts exceeded');
        continue;
      }
      await this.syncJobs.markRunning(job.id);
      await this.syncJobs.markSucceeded(job.id);
    }
  }

  private generateBlockHash(chain: ChainNetwork, height: bigint): string {
    return createHash('sha256')
      .update(`${chain}:${height.toString()}:${randomBytes(8).toString('hex')}`)
      .digest('hex');
  }
}
