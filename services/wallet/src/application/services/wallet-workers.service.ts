import {
  Inject,
  Injectable,
  Logger,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import { ENV, type ServiceEnv } from '../../config/env.schema';
import {
  BLOCKCHAIN_HTTP_CLIENT,
  type BlockchainHttpClientPort,
} from '../../infrastructure/blockchain/blockchain-client.port';
import { WALLET_REPOSITORY, type WalletRepositoryPort } from '../ports/wallet-repository.port';
import { PortfolioEngineService } from './portfolio-engine.service';
import { WalletRetryQueue } from './wallet-retry.queue';
import { WalletSyncService } from './wallet-sync.service';
import { PHASE18_SUPPORTED_NETWORKS, withWalletSpan } from './wallet-engine.types';

type WorkerHealth = {
  name: string;
  lastRunAt: string | null;
  lastDurationMs: number | null;
  lastError: string | null;
  runs: number;
};

/**
 * Background workers for Phase 18 wallet infrastructure.
 * Sync / Balance / Transaction / Portfolio / Retry / Health.
 */
@Injectable()
export class WalletWorkersService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(WalletWorkersService.name);
  private timers: NodeJS.Timeout[] = [];
  private readonly health = new Map<string, WorkerHealth>();
  /** Prevent overlapping interval ticks for the same worker name. */
  private readonly inFlight = new Set<string>();

  constructor(
    @Inject(ENV) private readonly env: ServiceEnv,
    @Inject(WALLET_REPOSITORY) private readonly wallets: WalletRepositoryPort,
    @Inject(WalletSyncService) private readonly sync: WalletSyncService,
    @Inject(PortfolioEngineService) private readonly portfolio: PortfolioEngineService,
    @Inject(WalletRetryQueue) private readonly retries: WalletRetryQueue,
    @Inject(BLOCKCHAIN_HTTP_CLIENT) private readonly blockchain: BlockchainHttpClientPort,
  ) {
    for (const name of [
      'sync',
      'balance',
      'transaction',
      'portfolio',
      'retry',
      'health',
    ] as const) {
      this.health.set(name, {
        name,
        lastRunAt: null,
        lastDurationMs: null,
        lastError: null,
        runs: 0,
      });
    }
  }

  onModuleInit(): void {
    if (!this.env.WALLET_WORKERS_ENABLED || this.env.NODE_ENV === 'test') {
      this.logger.log('Wallet workers disabled');
      return;
    }
    this.schedule('sync', this.env.WALLET_SYNC_INTERVAL_MS, () => this.runSyncWorker());
    this.schedule('balance', this.env.WALLET_BALANCE_INTERVAL_MS, () => this.runBalanceWorker());
    this.schedule('transaction', this.env.WALLET_SYNC_INTERVAL_MS + 5_000, () =>
      this.runTransactionWorker(),
    );
    this.schedule('portfolio', this.env.WALLET_PORTFOLIO_INTERVAL_MS, () =>
      this.runPortfolioWorker(),
    );
    this.schedule('retry', this.env.WALLET_RETRY_INTERVAL_MS, () => this.runRetryWorker());
    this.schedule('health', this.env.WALLET_HEALTH_INTERVAL_MS, () => this.runHealthWorker());
    this.logger.log('Wallet workers started');
  }

  onModuleDestroy(): void {
    for (const timer of this.timers) {
      clearInterval(timer);
    }
    this.timers = [];
  }

  getWorkerHealth(): WorkerHealth[] {
    return [...this.health.values()];
  }

  async runSyncWorker(): Promise<void> {
    await this.track('sync', async () => {
      await withWalletSpan('wallet.worker.sync', {}, async () => {
        const results = await this.sync.syncBalancesBatch(25);
        const failed = results.filter((r) => !r.ok).length;
        this.logger.debug(`Sync worker processed=${results.length} failed=${failed}`);
      });
    });
  }

  async runBalanceWorker(): Promise<void> {
    await this.track('balance', async () => {
      await withWalletSpan('wallet.worker.balance', {}, async () => {
        await this.sync.syncBalancesBatch(25);
      });
    });
  }

  async runTransactionWorker(): Promise<void> {
    await this.track('transaction', async () => {
      await withWalletSpan('wallet.worker.transaction', {}, async () => {
        const { processed, duplicates } = await this.sync.syncTransactionsBatch(25);
        this.logger.debug(`Tx worker processed=${processed} duplicates=${duplicates}`);
      });
    });
  }

  async runPortfolioWorker(): Promise<void> {
    await this.track('portfolio', async () => {
      await withWalletSpan('wallet.worker.portfolio', {}, async () => {
        const wallets = await this.wallets.listActiveForSync(0, 50);
        const owners = new Set(wallets.map((w) => w.ownerUserId));
        for (const owner of owners) {
          const owned = wallets.filter((w) => w.ownerUserId === owner);
          await this.portfolio.aggregate(owner, owned);
        }
      });
    });
  }

  async runRetryWorker(): Promise<void> {
    await this.track('retry', async () => {
      await withWalletSpan('wallet.worker.retry', {}, async () => {
        const jobs = this.retries.drain(20);
        for (const job of jobs) {
          const wallet = await this.wallets.findById(job.walletId);
          if (!wallet) continue;
          await this.sync.syncWallet(wallet);
        }
      });
    });
  }

  async runHealthWorker(): Promise<void> {
    await this.track('health', async () => {
      await withWalletSpan('wallet.worker.health', {}, async () => {
        for (const chain of PHASE18_SUPPORTED_NETWORKS) {
          const status = await this.blockchain.getNetworkStatus(chain);
          if (status && !status.healthy) {
            this.logger.warn(`Chain unhealthy chain=${chain} latencyMs=${status.latencyMs}`);
          }
        }
      });
    });
  }

  private schedule(name: string, intervalMs: number, fn: () => Promise<void>): void {
    const timer = setInterval(() => {
      if (this.inFlight.has(name)) {
        this.logger.debug(`Worker ${name} skipped — previous run still in flight`);
        return;
      }
      this.inFlight.add(name);
      fn()
        .catch((error: unknown) => {
          this.logger.error(
            `Worker ${name} failed: ${error instanceof Error ? error.message : String(error)}`,
          );
        })
        .finally(() => {
          this.inFlight.delete(name);
        });
    }, intervalMs);
    timer.unref();
    this.timers.push(timer);
  }

  private async track(name: string, fn: () => Promise<void>): Promise<void> {
    const started = Date.now();
    const state = this.health.get(name)!;
    try {
      await fn();
      state.lastError = null;
    } catch (error) {
      state.lastError = error instanceof Error ? error.message.slice(0, 200) : 'error';
      throw error;
    } finally {
      state.lastRunAt = new Date().toISOString();
      state.lastDurationMs = Date.now() - started;
      state.runs += 1;
    }
  }
}
