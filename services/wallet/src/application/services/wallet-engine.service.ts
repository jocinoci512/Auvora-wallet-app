import { Inject, Injectable, Logger } from '@nestjs/common';
import type { Prisma, WalletStatus } from '@auvora/database';
import type { JwtAccessClaims, PermissionCode } from '@auvora/types';
import { ForbiddenError, NotFoundError, ValidationError } from '../../domain';
import { PERMISSION_WALLETS_ADMIN } from '../../domain/permission-codes';
import {
  BLOCKCHAIN_HTTP_CLIENT,
  type BlockchainHttpClientPort,
} from '../../infrastructure/blockchain/blockchain-client.port';
import { WalletService, type CreateWalletInput } from './wallet.service';
import {
  defaultDerivationPath,
  mergeChainSync,
  PHASE18_SUPPORTED_NETWORKS,
  readChainSync,
  readPreferences,
  tokenStandardForChain,
  withWalletSpan,
  type ChainSyncMetadata,
  type WalletAccountPreference,
  type WalletPreferences,
} from './wallet-engine.types';
import {
  WALLET_REPOSITORY,
  type WalletRecord,
  type WalletRepositoryPort,
} from '../ports/wallet-repository.port';

export type CreateEngineWalletInput = CreateWalletInput & {
  /** When true, request a chain address from the blockchain service and link it. */
  provisionAddress?: boolean;
  accountIndex?: number;
  accountLabel?: string;
};

export type ImportPublicAddressInput = {
  ownerUserId: string;
  assetCode: string;
  address: string;
  alias?: string;
  label?: string;
  accountIndex?: number;
};

export type WalletExportBundle = {
  walletId: string;
  assetCode: string;
  assetChain: string;
  assetStandard: string;
  alias: string | null;
  label: string | null;
  status: WalletStatus;
  preferences: WalletPreferences;
  chainSync: ChainSyncMetadata;
  /** Explicit: private keys are never included. */
  containsPrivateKeys: false;
  exportedAt: string;
};

@Injectable()
export class WalletEngineService {
  private readonly logger = new Logger(WalletEngineService.name);

  constructor(
    @Inject(WalletService) private readonly wallets: WalletService,
    @Inject(WALLET_REPOSITORY) private readonly walletRepo: WalletRepositoryPort,
    @Inject(BLOCKCHAIN_HTTP_CLIENT) private readonly blockchain: BlockchainHttpClientPort,
  ) {}

  async createWallet(input: CreateEngineWalletInput): Promise<WalletRecord> {
    return withWalletSpan(
      'wallet.engine.create',
      { asset: input.assetCode, provision: Boolean(input.provisionAddress) },
      async () => {
        const accountIndex = input.accountIndex ?? 0;
        const preferences: WalletPreferences = {
          activeAccountIndex: accountIndex,
          accounts: [
            {
              index: accountIndex,
              label: input.accountLabel ?? 'Primary',
              isDefault: true,
              derivationPath: undefined,
            },
          ],
          preferredNetworks: [...PHASE18_SUPPORTED_NETWORKS],
        };

        const created = await this.wallets.createWallet({
          ...input,
          preferences: {
            ...(input.preferences ?? {}),
            ...preferences,
          },
          metadata: {
            ...(input.metadata ?? {}),
            engine: 'phase18',
            exportPolicy: 'public_metadata_only',
          },
        });

        const asset = await this.walletRepo.findAssetByCode(input.assetCode);
        const chain = asset?.chain ?? created.assetChain;
        const path = defaultDerivationPath(chain, accountIndex);
        const accounts = (preferences.accounts ?? []).map((a) =>
          a.index === accountIndex ? { ...a, derivationPath: path } : a,
        );

        let updated = await this.walletRepo.update(created.id, {
          preferences: {
            ...preferences,
            activeNetwork: chain,
            accounts,
          } as Prisma.InputJsonValue,
        });

        if (input.provisionAddress !== false) {
          updated = await this.attachGeneratedAddress(updated, input.ownerUserId);
        }
        return updated;
      },
    );
  }

  /**
   * Restore archived wallet to ACTIVE and optionally re-verify recovery metadata.
   * Does not accept or process seed phrases / private keys.
   */
  async restoreWallet(
    walletId: string,
    requester: JwtAccessClaims,
    reason?: string,
  ): Promise<WalletRecord> {
    const restored = await this.wallets.restore(walletId, requester, reason ?? 'Engine restore');
    return this.verifyRecovery(restored.id, requester);
  }

  /**
   * Import a wallet by public address only — never accepts private keys or mnemonics.
   */
  async importPublicAddress(
    input: ImportPublicAddressInput,
    requester: JwtAccessClaims,
  ): Promise<WalletRecord> {
    if (input.ownerUserId !== requester.sub && !this.hasAdmin(requester)) {
      throw new ForbiddenError('Access denied');
    }
    const asset = await this.walletRepo.findAssetByCode(input.assetCode);
    if (!asset) {
      throw new NotFoundError(`Asset not found: ${input.assetCode}`);
    }
    const valid = await this.blockchain.validateAddress(asset.chain, input.address);
    if (!valid) {
      throw new ValidationError(`Invalid ${asset.chain} address`);
    }

    const accountIndex = input.accountIndex ?? 0;
    const created = await this.createWallet({
      ownerUserId: input.ownerUserId,
      assetCode: input.assetCode,
      alias: input.alias,
      label: input.label,
      provisionAddress: false,
      accountIndex,
      metadata: {
        imported: true,
        importMode: 'public_address',
      },
    });

    const patched = mergeChainSync(created.metadata, {
      address: input.address,
      chain: asset.chain,
      importMode: 'public_address',
      lastSyncedAt: undefined,
      retryCount: 0,
    });
    const prefs = readPreferences(created.preferences);
    const accounts = (prefs.accounts ?? []).map((a) =>
      a.index === accountIndex ? { ...a, address: input.address } : a,
    );

    return this.walletRepo.update(created.id, {
      metadata: patched as Prisma.InputJsonValue,
      preferences: { ...prefs, accounts, activeNetwork: asset.chain } as Prisma.InputJsonValue,
    });
  }

  /** Public metadata export — never includes private key material. */
  async exportWallet(walletId: string, requester: JwtAccessClaims): Promise<WalletExportBundle> {
    const wallet = await this.wallets.getWallet(walletId, requester);
    const chainSync = readChainSync(wallet.metadata);
    // Defensive: strip any accidental sensitive keys from metadata before export.
    const sanitized: ChainSyncMetadata = {
      address: chainSync.address,
      addressId: chainSync.addressId,
      chain: chainSync.chain ?? wallet.assetChain,
      lastBalance: chainSync.lastBalance,
      lastSyncedAt: chainSync.lastSyncedAt,
      lastBlockHeight: chainSync.lastBlockHeight,
      importMode: chainSync.importMode,
      recoveryVerifiedAt: chainSync.recoveryVerifiedAt,
      exportPolicy: 'public_metadata_only',
      retryCount: chainSync.retryCount,
    };
    return {
      walletId: wallet.id,
      assetCode: wallet.assetCode,
      assetChain: wallet.assetChain,
      assetStandard: wallet.assetStandard,
      alias: wallet.alias,
      label: wallet.label,
      status: wallet.status,
      preferences: readPreferences(wallet.preferences),
      chainSync: sanitized,
      containsPrivateKeys: false,
      exportedAt: new Date().toISOString(),
    };
  }

  async validateAddress(chain: string, address: string): Promise<boolean> {
    return this.blockchain.validateAddress(chain, address);
  }

  async generateAddress(
    walletId: string,
    requester: JwtAccessClaims,
  ): Promise<{ wallet: WalletRecord; address: string | null }> {
    const wallet = await this.wallets.getWallet(walletId, requester);
    const updated = await this.attachGeneratedAddress(wallet, requester.sub);
    const sync = readChainSync(updated.metadata);
    return { wallet: updated, address: sync.address ?? null };
  }

  async switchNetwork(
    walletId: string,
    network: string,
    requester: JwtAccessClaims,
  ): Promise<WalletRecord> {
    const wallet = await this.wallets.getWallet(walletId, requester);
    const normalized = network.trim().toUpperCase().replace(/[-\s]/g, '_');
    const allowed =
      (PHASE18_SUPPORTED_NETWORKS as readonly string[]).includes(normalized) ||
      normalized === wallet.assetChain;
    if (!allowed) {
      throw new ValidationError(`Unsupported network ${network}`);
    }
    const prefs = readPreferences(wallet.preferences);
    return this.walletRepo.update(walletId, {
      preferences: {
        ...prefs,
        activeNetwork: normalized,
        preferredNetworks: Array.from(new Set([...(prefs.preferredNetworks ?? []), normalized])),
      } as Prisma.InputJsonValue,
    });
  }

  async switchAccount(
    walletId: string,
    accountIndex: number,
    requester: JwtAccessClaims,
  ): Promise<WalletRecord> {
    const wallet = await this.wallets.getWallet(walletId, requester);
    const prefs = readPreferences(wallet.preferences);
    const index = Math.max(0, Math.floor(accountIndex));
    let accounts = prefs.accounts ?? [];
    if (!accounts.some((a) => a.index === index)) {
      const account: WalletAccountPreference = {
        index,
        label: `Account ${index}`,
        derivationPath: defaultDerivationPath(wallet.assetChain, index),
        isDefault: false,
      };
      accounts = [...accounts, account];
    }
    accounts = accounts.map((a) => ({ ...a, isDefault: a.index === index }));
    return this.walletRepo.update(walletId, {
      preferences: {
        ...prefs,
        activeAccountIndex: index,
        accounts,
      } as Prisma.InputJsonValue,
    });
  }

  async listAccounts(
    walletId: string,
    requester: JwtAccessClaims,
  ): Promise<WalletAccountPreference[]> {
    const wallet = await this.wallets.getWallet(walletId, requester);
    return readPreferences(wallet.preferences).accounts ?? [];
  }

  async discoverAccounts(
    walletId: string,
    requester: JwtAccessClaims,
    count = 3,
  ): Promise<WalletAccountPreference[]> {
    const wallet = await this.wallets.getWallet(walletId, requester);
    const prefs = readPreferences(wallet.preferences);
    const existing = new Map((prefs.accounts ?? []).map((a) => [a.index, a]));
    const discovered: WalletAccountPreference[] = [];
    for (let i = 0; i < Math.min(Math.max(count, 1), 10); i += 1) {
      const account =
        existing.get(i) ??
        ({
          index: i,
          label: i === 0 ? 'Primary' : `Account ${i}`,
          derivationPath: defaultDerivationPath(wallet.assetChain, i),
          isDefault: i === (prefs.activeAccountIndex ?? 0),
        } satisfies WalletAccountPreference);
      discovered.push(account);
      existing.set(i, account);
    }
    await this.walletRepo.update(walletId, {
      preferences: {
        ...prefs,
        accounts: [...existing.values()].sort((a, b) => a.index - b.index),
      } as Prisma.InputJsonValue,
    });
    return discovered;
  }

  async verifyRecovery(walletId: string, requester: JwtAccessClaims): Promise<WalletRecord> {
    const wallet = await this.wallets.getWallet(walletId, requester);
    const sync = readChainSync(wallet.metadata);
    if (!sync.address && sync.importMode !== 'generated') {
      this.logger.debug(`Recovery verification without chain address wallet=${walletId}`);
    }
    const patched = mergeChainSync(wallet.metadata, {
      recoveryVerifiedAt: new Date().toISOString(),
    });
    return this.walletRepo.update(walletId, {
      metadata: patched as Prisma.InputJsonValue,
    });
  }

  async requireWallet(walletId: string, requester: JwtAccessClaims): Promise<WalletRecord> {
    return this.wallets.getWallet(walletId, requester);
  }

  async getSupportedNetworks(): Promise<Array<{ chain: string; tokenStandard: string }>> {
    const chains = await this.blockchain.listChains();
    const filtered = chains.filter((c) =>
      (PHASE18_SUPPORTED_NETWORKS as readonly string[]).includes(c),
    );
    const list = filtered.length ? filtered : [...PHASE18_SUPPORTED_NETWORKS];
    return list.map((chain) => ({ chain, tokenStandard: tokenStandardForChain(chain) }));
  }

  private async attachGeneratedAddress(
    wallet: WalletRecord,
    ownerUserId: string,
  ): Promise<WalletRecord> {
    const result = await this.blockchain.createAddress({
      chain: wallet.assetChain,
      ownerUserId,
      walletId: wallet.id,
      label: wallet.label ?? wallet.alias ?? undefined,
    });
    if (!result?.address) {
      this.logger.warn(
        `Address provision deferred for wallet=${wallet.id} chain=${wallet.assetChain} (blockchain unavailable)`,
      );
      return wallet;
    }
    const patched = mergeChainSync(wallet.metadata, {
      address: result.address,
      addressId: result.id,
      chain: result.chain ?? wallet.assetChain,
      importMode: 'generated',
      retryCount: 0,
      lastError: undefined,
    });
    const prefs = readPreferences(wallet.preferences);
    const active = prefs.activeAccountIndex ?? 0;
    const accounts = (prefs.accounts ?? []).map((a) =>
      a.index === active ? { ...a, address: result.address } : a,
    );
    return this.walletRepo.update(wallet.id, {
      metadata: patched as Prisma.InputJsonValue,
      preferences: { ...prefs, accounts } as Prisma.InputJsonValue,
    });
  }

  private hasAdmin(requester: JwtAccessClaims): boolean {
    return requester.permissions.includes(PERMISSION_WALLETS_ADMIN as PermissionCode);
  }
}
