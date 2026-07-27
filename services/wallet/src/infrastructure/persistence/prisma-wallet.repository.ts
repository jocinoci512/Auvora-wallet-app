import { Inject, Injectable } from '@nestjs/common';
import { WalletStatus, PrismaService } from '@auvora/database';
import type {
  CreateWalletData,
  StatusHistoryRecord,
  UpdateWalletData,
  WalletRecord,
  WalletRepositoryPort,
  WalletSearchFilters,
  WalletSearchResult,
} from '../../application/ports/wallet-repository.port';

const walletInclude = {
  asset: true,
} as const;

function mapWallet(record: {
  id: string;
  ownerUserId: string;
  assetId: string;
  alias: string | null;
  label: string | null;
  status: WalletStatus;
  metadata: unknown;
  preferences: unknown;
  createdAt: Date;
  updatedAt: Date;
  archivedAt: Date | null;
  asset: { code: string; symbol: string; decimals: number; chain: string; standard: string };
}): WalletRecord {
  return {
    id: record.id,
    ownerUserId: record.ownerUserId,
    assetId: record.assetId,
    assetCode: record.asset.code,
    assetSymbol: record.asset.symbol,
    assetDecimals: record.asset.decimals,
    assetChain: record.asset.chain,
    assetStandard: record.asset.standard,
    alias: record.alias,
    label: record.label,
    status: record.status,
    metadata: record.metadata as WalletRecord['metadata'],
    preferences: record.preferences as WalletRecord['preferences'],
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    archivedAt: record.archivedAt,
  };
}

@Injectable()
export class PrismaWalletRepository implements WalletRepositoryPort {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async findAssetByCode(code: string): Promise<{
    id: string;
    code: string;
    symbol: string;
    decimals: number;
    chain: string;
    standard: string;
  } | null> {
    const asset = await this.prisma.asset.findUnique({
      where: { code },
      select: {
        id: true,
        code: true,
        symbol: true,
        decimals: true,
        chain: true,
        standard: true,
        isActive: true,
      },
    });
    if (!asset || !asset.isActive) {
      return null;
    }
    return {
      id: asset.id,
      code: asset.code,
      symbol: asset.symbol,
      decimals: asset.decimals,
      chain: asset.chain,
      standard: asset.standard,
    };
  }

  async findById(id: string): Promise<WalletRecord | null> {
    const wallet = await this.prisma.wallet.findFirst({
      where: { id, deletedAt: null },
      include: walletInclude,
    });
    return wallet ? mapWallet(wallet) : null;
  }

  async findByOwnerAssetAlias(
    ownerUserId: string,
    assetId: string,
    alias: string | null,
  ): Promise<WalletRecord | null> {
    const wallet = await this.prisma.wallet.findFirst({
      where: {
        ownerUserId,
        assetId,
        alias,
        deletedAt: null,
      },
      include: walletInclude,
    });
    return wallet ? mapWallet(wallet) : null;
  }

  async createWithZeroBalance(data: CreateWalletData): Promise<WalletRecord> {
    return this.prisma.$transaction(async (tx) => {
      const wallet = await tx.wallet.create({
        data: {
          ownerUserId: data.ownerUserId,
          assetId: data.assetId,
          alias: data.alias ?? null,
          label: data.label ?? null,
          status: WalletStatus.PENDING,
          metadata: data.metadata,
          preferences: data.preferences,
        },
        include: walletInclude,
      });

      await tx.walletBalance.create({
        data: {
          walletId: wallet.id,
          assetId: data.assetId,
          available: 0,
          pending: 0,
          locked: 0,
          reserved: 0,
          total: 0,
        },
      });

      await tx.walletStatusHistory.create({
        data: {
          walletId: wallet.id,
          fromStatus: null,
          toStatus: WalletStatus.PENDING,
          reason: 'Wallet created',
          actorId: data.ownerUserId,
        },
      });

      return mapWallet(wallet);
    });
  }

  async update(id: string, data: UpdateWalletData): Promise<WalletRecord> {
    const wallet = await this.prisma.wallet.update({
      where: { id },
      data: {
        alias: data.alias,
        label: data.label,
        metadata: data.metadata,
        preferences: data.preferences,
      },
      include: walletInclude,
    });
    return mapWallet(wallet);
  }

  async transitionStatus(
    walletId: string,
    toStatus: WalletStatus,
    actorId: string | null,
    reason?: string,
  ): Promise<WalletRecord> {
    return this.prisma.$transaction(async (tx) => {
      const current = await tx.wallet.findUniqueOrThrow({
        where: { id: walletId },
        include: walletInclude,
      });

      const wallet = await tx.wallet.update({
        where: { id: walletId },
        data: {
          status: toStatus,
          archivedAt: toStatus === WalletStatus.ARCHIVED ? new Date() : null,
        },
        include: walletInclude,
      });

      await tx.walletStatusHistory.create({
        data: {
          walletId,
          fromStatus: current.status,
          toStatus,
          reason: reason ?? null,
          actorId,
        },
      });

      return mapWallet(wallet);
    });
  }

  async listByOwner(ownerUserId: string, skip = 0, take = 50): Promise<WalletSearchResult> {
    const where = { ownerUserId, deletedAt: null };
    const [items, total] = await Promise.all([
      this.prisma.wallet.findMany({
        where,
        include: walletInclude,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.wallet.count({ where }),
    ]);
    return { items: items.map(mapWallet), total };
  }

  async search(filters: WalletSearchFilters): Promise<WalletSearchResult> {
    const where = {
      deletedAt: null,
      ...(filters.ownerUserId ? { ownerUserId: filters.ownerUserId } : {}),
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.assetCode ? { asset: { code: filters.assetCode } } : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.wallet.findMany({
        where,
        include: walletInclude,
        skip: filters.skip ?? 0,
        take: filters.take ?? 50,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.wallet.count({ where }),
    ]);

    return { items: items.map(mapWallet), total };
  }

  async getStatusHistory(walletId: string, skip = 0, take = 50): Promise<StatusHistoryRecord[]> {
    const records = await this.prisma.walletStatusHistory.findMany({
      where: { walletId },
      skip,
      take,
      orderBy: { createdAt: 'desc' },
    });
    return records.map((r) => ({
      id: r.id,
      walletId: r.walletId,
      fromStatus: r.fromStatus,
      toStatus: r.toStatus,
      reason: r.reason,
      actorId: r.actorId,
      createdAt: r.createdAt,
    }));
  }

  async listActiveForSync(skip = 0, take = 100): Promise<WalletRecord[]> {
    const items = await this.prisma.wallet.findMany({
      where: { status: WalletStatus.ACTIVE, deletedAt: null },
      include: walletInclude,
      skip,
      take,
      orderBy: { updatedAt: 'asc' },
    });
    return items.map(mapWallet);
  }
}
