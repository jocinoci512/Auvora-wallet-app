import { Inject, Injectable, Logger } from '@nestjs/common';
import type { Prisma } from '@auvora/database';
import {
  BLOCKCHAIN_HTTP_CLIENT,
  type BlockchainHttpClientPort,
} from '../../infrastructure/blockchain/blockchain-client.port';
import { LEDGER_REPOSITORY, type LedgerRepositoryPort } from '../ports/ledger-repository.port';
import {
  WALLET_REPOSITORY,
  type WalletRecord,
  type WalletRepositoryPort,
} from '../ports/wallet-repository.port';
import { mergeChainSync, readChainSync, withWalletSpan } from './wallet-engine.types';
import { WalletRetryQueue } from './wallet-retry.queue';

export type SyncResult = {
  walletId: string;
  ok: boolean;
  balance?: string;
  blockHeight?: string;
  error?: string;
  duplicated?: boolean;
};

@Injectable()
export class WalletSyncService {
  private readonly logger = new Logger(WalletSyncService.name);
  private readonly recentTxKeys = new Set<string>();

  constructor(
    @Inject(WALLET_REPOSITORY) private readonly wallets: WalletRepositoryPort,
    @Inject(LEDGER_REPOSITORY) private readonly ledger: LedgerRepositoryPort,
    @Inject(BLOCKCHAIN_HTTP_CLIENT) private readonly blockchain: BlockchainHttpClientPort,
    @Inject(WalletRetryQueue) private readonly retries: WalletRetryQueue,
  ) {}

  async syncWallet(wallet: WalletRecord): Promise<SyncResult> {
    return withWalletSpan(
      'wallet.sync',
      { walletId: wallet.id, chain: wallet.assetChain },
      async () => {
        const sync = readChainSync(wallet.metadata);
        const address = sync.address;
        if (!address) {
          return { walletId: wallet.id, ok: false, error: 'no_chain_address' };
        }

        try {
          const [balance, network] = await Promise.all([
            this.blockchain.getBalance(wallet.assetChain, address),
            this.blockchain.getNetworkStatus(wallet.assetChain),
          ]);

          const patched = mergeChainSync(wallet.metadata, {
            lastBalance: balance?.balance ?? sync.lastBalance,
            lastSyncedAt: new Date().toISOString(),
            lastBlockHeight: network?.blockHeight ?? sync.lastBlockHeight,
            lastError: undefined,
            retryCount: 0,
          });

          await this.wallets.update(wallet.id, {
            metadata: patched as Prisma.InputJsonValue,
          });

          // Snapshot at most once per successful sync path; swallow snapshot errors.
          await this.ledger
            .createSnapshot(wallet.id, 'chain_sync_refresh', 'wallet-sync-worker')
            .catch(() => undefined);

          await this.blockchain.triggerSync(wallet.assetChain).catch(() => null);

          return {
            walletId: wallet.id,
            ok: true,
            balance: balance?.balance,
            blockHeight: network?.blockHeight,
          };
        } catch (error) {
          const message = error instanceof Error ? error.message.slice(0, 200) : 'sync_failed';
          const retryCount = (sync.retryCount ?? 0) + 1;
          const patched = mergeChainSync(wallet.metadata, {
            lastError: message,
            retryCount,
          });
          await this.wallets.update(wallet.id, {
            metadata: patched as Prisma.InputJsonValue,
          });
          this.retries.enqueue({
            walletId: wallet.id,
            reason: message,
            attempts: retryCount,
          });
          this.logger.warn(`Sync failed wallet=${wallet.id}: ${message}`);
          return { walletId: wallet.id, ok: false, error: message };
        }
      },
    );
  }

  async syncBalancesBatch(limit = 50): Promise<SyncResult[]> {
    const wallets = await this.wallets.listActiveForSync(0, limit);
    const results: SyncResult[] = [];
    for (const wallet of wallets) {
      results.push(await this.syncWallet(wallet));
    }
    return results;
  }

  async syncTransactionsBatch(limit = 50): Promise<{ processed: number; duplicates: number }> {
    const wallets = await this.wallets.listActiveForSync(0, limit);
    let processed = 0;
    let duplicates = 0;
    for (const wallet of wallets) {
      const sync = readChainSync(wallet.metadata);
      if (!sync.address) continue;
      const key = `${wallet.assetChain}:${sync.address}:${sync.lastBlockHeight ?? '0'}`;
      if (this.recentTxKeys.has(key)) {
        duplicates += 1;
        continue;
      }
      this.recentTxKeys.add(key);
      if (this.recentTxKeys.size > 5_000) {
        this.recentTxKeys.clear();
      }
      await this.blockchain.triggerSync(wallet.assetChain).catch(() => null);
      processed += 1;
    }
    return { processed, duplicates };
  }

  detectConflict(previousBalance: string | undefined, nextBalance: string | undefined): boolean {
    if (previousBalance == null || nextBalance == null) return false;
    // Soft conflict: large unexpected jump flagged for retry inspection.
    const prev = Number(previousBalance);
    const next = Number(nextBalance);
    if (!Number.isFinite(prev) || !Number.isFinite(next)) return false;
    return Math.abs(next - prev) > Math.max(1, Math.abs(prev) * 10);
  }
}
