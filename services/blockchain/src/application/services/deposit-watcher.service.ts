import {
  Inject,
  Injectable,
  Logger,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import { ChainNetwork, type Prisma } from '@auvora/database';
import {
  CHAIN_ADDRESS_REPOSITORY,
  type ChainAddressRecord,
  type ChainAddressRepositoryPort,
} from '../ports/chain-address-repository.port';
import { PROVIDER_FACTORY, type ProviderFactoryPort } from '../ports/provider-factory.port';
import type { BlockchainProvider } from '../../domain';
import { ENV, type ServiceEnv } from '../../config/env.schema';
import { TESTNET_NETWORKS } from '../../domain/testnet-networks';
import {
  NOTIFICATIONS_PUBLISHER,
  type NotificationsPublisherPort,
} from '../../infrastructure/notifications/notifications-publisher.adapter';

/** Sepolia (testnet) confirmation threshold — lower than mainnet's 12. */
export const SEPOLIA_DEPOSIT_CONFIRMATIONS = 3;

const SEPOLIA_CHAIN_ID = String(TESTNET_NETWORKS[ChainNetwork.ETHEREUM].evmChainId ?? 11155111);

type PendingDepositSnapshot = {
  amount: string;
  previousBalance: string;
  detectedBalance: string;
  detectedAtBlock: string;
  detectedAt: string;
  detectedEmitted: boolean;
  confirmedEmitted: boolean;
};

type DepositWatcherMetadata = {
  lastKnownBalance?: string;
  lastPolledAt?: string;
  lastPolledBlock?: string;
  pendingDeposit?: PendingDepositSnapshot | null;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readWatcherMeta(metadata: unknown): DepositWatcherMetadata {
  if (!isRecord(metadata)) return {};
  const raw = metadata['depositWatcher'];
  if (!isRecord(raw)) return {};
  const pending = raw['pendingDeposit'];
  return {
    lastKnownBalance:
      typeof raw['lastKnownBalance'] === 'string' ? raw['lastKnownBalance'] : undefined,
    lastPolledAt: typeof raw['lastPolledAt'] === 'string' ? raw['lastPolledAt'] : undefined,
    lastPolledBlock:
      typeof raw['lastPolledBlock'] === 'string' ? raw['lastPolledBlock'] : undefined,
    pendingDeposit:
      pending === null
        ? null
        : isRecord(pending) &&
            typeof pending['amount'] === 'string' &&
            typeof pending['detectedAtBlock'] === 'string'
          ? {
              amount: pending['amount'],
              previousBalance: String(pending['previousBalance'] ?? '0'),
              detectedBalance: String(pending['detectedBalance'] ?? pending['amount']),
              detectedAtBlock: pending['detectedAtBlock'],
              detectedAt: String(pending['detectedAt'] ?? new Date().toISOString()),
              detectedEmitted: Boolean(pending['detectedEmitted']),
              confirmedEmitted: Boolean(pending['confirmedEmitted']),
            }
          : undefined,
  };
}

function ethToWei(eth: string): bigint {
  const normalized = eth.trim();
  if (!normalized || !/^\d+(\.\d+)?$/.test(normalized)) {
    throw new Error(`Invalid ETH amount: ${eth}`);
  }
  const [whole, frac = ''] = normalized.split('.');
  const fracPadded = (frac + '0'.repeat(18)).slice(0, 18);
  return BigInt(whole || '0') * 10n ** 18n + BigInt(fracPadded || '0');
}

function weiToEth(wei: bigint): string {
  const whole = wei / 10n ** 18n;
  const frac = wei % 10n ** 18n;
  const fracStr = frac.toString().padStart(18, '0').replace(/0+$/, '');
  return fracStr.length ? `${whole.toString()}.${fracStr}` : whole.toString();
}

function isAlchemyLive(provider: BlockchainProvider): provider is BlockchainProvider & {
  getSafeEndpoint(): string;
  getChainId?: () => Promise<string>;
} {
  return typeof (provider as { getSafeEndpoint?: unknown }).getSafeEndpoint === 'function';
}

/**
 * Polls watched Ethereum addresses on Sepolia (chainId 11155111) for native ETH
 * balance increases. Emits `blockchain.deposit.detected` then
 * `blockchain.deposit.confirmed` after {@link SEPOLIA_DEPOSIT_CONFIRMATIONS}.
 * Active only when `BLOCKCHAIN_NETWORK_ENV=testnet`. Never fabricates deposits —
 * skips the tick when Alchemy RPC is unavailable.
 */
@Injectable()
export class DepositWatcherService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DepositWatcherService.name);
  private timer?: NodeJS.Timeout;
  private ticking = false;

  constructor(
    @Inject(ENV) private readonly env: ServiceEnv,
    @Inject(CHAIN_ADDRESS_REPOSITORY) private readonly addresses: ChainAddressRepositoryPort,
    @Inject(PROVIDER_FACTORY) private readonly providers: ProviderFactoryPort,
    @Inject(NOTIFICATIONS_PUBLISHER) private readonly notifications: NotificationsPublisherPort,
  ) {}

  onModuleInit(): void {
    if (this.env.BLOCKCHAIN_NETWORK_ENV !== 'testnet') {
      this.logger.log('Sepolia deposit watcher disabled (BLOCKCHAIN_NETWORK_ENV != testnet)');
      return;
    }
    this.logger.log(
      `Sepolia deposit watcher starting intervalMs=${this.env.BLOCKCHAIN_SYNC_INTERVAL_MS} confirmations=${SEPOLIA_DEPOSIT_CONFIRMATIONS}`,
    );
    this.timer = setInterval(() => {
      this.poll().catch((error: unknown) => {
        this.logger.error(
          `Deposit watcher tick failed: ${error instanceof Error ? error.message : String(error)}`,
        );
      });
    }, this.env.BLOCKCHAIN_SYNC_INTERVAL_MS);
    this.timer.unref();
  }

  onModuleDestroy(): void {
    if (this.timer) {
      clearInterval(this.timer);
    }
  }

  /** Exposed for tests / manual ops. */
  async poll(): Promise<void> {
    if (this.env.BLOCKCHAIN_NETWORK_ENV !== 'testnet') return;
    if (this.ticking) return;
    this.ticking = true;
    try {
      await this.pollOnce();
    } finally {
      this.ticking = false;
    }
  }

  private async pollOnce(): Promise<void> {
    if (!this.providers.hasProvider(ChainNetwork.ETHEREUM)) {
      this.logger.warn('Sepolia deposit watcher: no Ethereum provider registered — skipping');
      return;
    }

    const provider = this.providers.getProvider(ChainNetwork.ETHEREUM);
    if (!isAlchemyLive(provider)) {
      this.logger.warn(
        'Sepolia deposit watcher: Alchemy RPC unavailable — skipping (no fake detection)',
      );
      return;
    }

    let blockHeight: bigint;
    try {
      if (typeof provider.getChainId === 'function') {
        const chainId = await provider.getChainId();
        if (chainId !== SEPOLIA_CHAIN_ID) {
          this.logger.warn(
            `Sepolia deposit watcher: unexpected chainId=${chainId} (expected ${SEPOLIA_CHAIN_ID}) — skipping`,
          );
          return;
        }
      }
      blockHeight = await provider.getBlockHeight();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Sepolia deposit watcher: RPC tip/chainId failed — skipping: ${message}`);
      return;
    }

    const watched = await this.addresses.listWatched(ChainNetwork.ETHEREUM);
    for (const address of watched) {
      try {
        await this.pollAddress(provider, address, blockHeight);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        this.logger.warn(`Sepolia deposit watcher: skip address ${address.id}: ${message}`);
      }
    }
  }

  private async pollAddress(
    provider: BlockchainProvider,
    address: ChainAddressRecord,
    blockHeight: bigint,
  ): Promise<void> {
    let balance: string;
    try {
      balance = await provider.getBalance(address.address);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(
        `Sepolia deposit watcher: eth_getBalance failed for ${address.address} — skipping: ${message}`,
      );
      return;
    }

    const existingMeta = isRecord(address.metadata) ? { ...address.metadata } : {};
    const watcher = readWatcherMeta(address.metadata);
    const nowIso = new Date().toISOString();

    // First observation — baseline only, never emit.
    if (watcher.lastKnownBalance === undefined) {
      await this.persistWatcher(address.id, existingMeta, {
        lastKnownBalance: balance,
        lastPolledAt: nowIso,
        lastPolledBlock: blockHeight.toString(),
        pendingDeposit: null,
      });
      return;
    }

    const previousWei = ethToWei(watcher.lastKnownBalance);
    const currentWei = ethToWei(balance);
    let pending = watcher.pendingDeposit ?? null;

    if (currentWei > previousWei && (!pending || pending.confirmedEmitted)) {
      const delta = weiToEth(currentWei - previousWei);
      pending = {
        amount: delta,
        previousBalance: watcher.lastKnownBalance,
        detectedBalance: balance,
        detectedAtBlock: blockHeight.toString(),
        detectedAt: nowIso,
        detectedEmitted: false,
        confirmedEmitted: false,
      };
    }

    if (pending && !pending.detectedEmitted) {
      await this.notifications.publishEvent({
        eventType: 'blockchain.deposit.detected',
        aggregateId: `${address.id}:${pending.detectedAtBlock}`,
        payload: {
          ownerUserId: address.ownerUserId,
          chainAddressId: address.id,
          address: address.address,
          assetCode: 'ETH',
          amount: pending.amount,
          network: TESTNET_NETWORKS[ChainNetwork.ETHEREUM].displayName,
          chainId: SEPOLIA_CHAIN_ID,
          blockNumber: pending.detectedAtBlock,
        },
      });
      pending = { ...pending, detectedEmitted: true };
      this.logger.log(
        `Deposit detected address=${address.address} amount=${pending.amount} ETH block=${pending.detectedAtBlock}`,
      );
    }

    if (pending && pending.detectedEmitted && !pending.confirmedEmitted) {
      const detectedBlock = BigInt(pending.detectedAtBlock);
      const confirmations = Number(blockHeight - detectedBlock) + 1;
      if (confirmations >= SEPOLIA_DEPOSIT_CONFIRMATIONS) {
        await this.notifications.publishEvent({
          eventType: 'blockchain.deposit.confirmed',
          aggregateId: `${address.id}:${pending.detectedAtBlock}`,
          payload: {
            ownerUserId: address.ownerUserId,
            chainAddressId: address.id,
            address: address.address,
            assetCode: 'ETH',
            amount: pending.amount,
            network: TESTNET_NETWORKS[ChainNetwork.ETHEREUM].displayName,
            chainId: SEPOLIA_CHAIN_ID,
            blockNumber: pending.detectedAtBlock,
            confirmations,
          },
        });
        pending = { ...pending, confirmedEmitted: true };
        this.logger.log(
          `Deposit confirmed address=${address.address} amount=${pending.amount} ETH confirmations=${confirmations}`,
        );
      }
    }

    await this.persistWatcher(address.id, existingMeta, {
      lastKnownBalance: balance,
      lastPolledAt: nowIso,
      lastPolledBlock: blockHeight.toString(),
      pendingDeposit: pending && !pending.confirmedEmitted ? pending : null,
    });
  }

  private async persistWatcher(
    addressId: string,
    existingMeta: Record<string, unknown>,
    watcher: DepositWatcherMetadata,
  ): Promise<void> {
    const next: Record<string, unknown> = {
      ...existingMeta,
      depositWatcher: watcher,
    };
    await this.addresses.update(addressId, {
      metadata: next as Prisma.InputJsonValue,
    });
  }
}
