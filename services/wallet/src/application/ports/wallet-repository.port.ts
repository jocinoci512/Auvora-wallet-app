import type { Prisma, WalletStatus } from '@auvora/database';

export const WALLET_REPOSITORY = Symbol('WALLET_REPOSITORY');

export interface WalletRecord {
  id: string;
  ownerUserId: string;
  assetId: string;
  assetCode: string;
  assetSymbol: string;
  assetDecimals: number;
  /** Chain for the wallet's asset (Phase 18 portfolio / sync). */
  assetChain: string;
  assetStandard: string;
  alias: string | null;
  label: string | null;
  status: WalletStatus;
  metadata: Prisma.JsonValue | null;
  preferences: Prisma.JsonValue | null;
  createdAt: Date;
  updatedAt: Date;
  archivedAt: Date | null;
}

export interface CreateWalletData {
  ownerUserId: string;
  assetId: string;
  alias?: string | null;
  label?: string | null;
  metadata?: Prisma.InputJsonValue;
  preferences?: Prisma.InputJsonValue;
}

export interface UpdateWalletData {
  alias?: string | null;
  label?: string | null;
  metadata?: Prisma.InputJsonValue;
  preferences?: Prisma.InputJsonValue;
}

export interface WalletSearchFilters {
  ownerUserId?: string;
  status?: WalletStatus;
  assetCode?: string;
  skip?: number;
  take?: number;
}

export interface WalletSearchResult {
  items: WalletRecord[];
  total: number;
}

export interface StatusHistoryRecord {
  id: string;
  walletId: string;
  fromStatus: WalletStatus | null;
  toStatus: WalletStatus;
  reason: string | null;
  actorId: string | null;
  createdAt: Date;
}

export interface WalletRepositoryPort {
  findAssetByCode(code: string): Promise<{
    id: string;
    code: string;
    symbol: string;
    decimals: number;
    chain: string;
    standard: string;
  } | null>;
  findById(id: string): Promise<WalletRecord | null>;
  findByOwnerAssetAlias(
    ownerUserId: string,
    assetId: string,
    alias: string | null,
  ): Promise<WalletRecord | null>;
  createWithZeroBalance(data: CreateWalletData): Promise<WalletRecord>;
  update(id: string, data: UpdateWalletData): Promise<WalletRecord>;
  transitionStatus(
    walletId: string,
    toStatus: WalletStatus,
    actorId: string | null,
    reason?: string,
  ): Promise<WalletRecord>;
  listByOwner(ownerUserId: string, skip?: number, take?: number): Promise<WalletSearchResult>;
  search(filters: WalletSearchFilters): Promise<WalletSearchResult>;
  getStatusHistory(walletId: string, skip?: number, take?: number): Promise<StatusHistoryRecord[]>;
  /** Active wallets eligible for background sync (Phase 18). */
  listActiveForSync(skip?: number, take?: number): Promise<WalletRecord[]>;
}
