import { Inject, Injectable } from '@nestjs/common';
import { type ChainAddressStatus, type ChainNetwork, PrismaService } from '@auvora/database';
import type {
  ChainAddressFilters,
  ChainAddressRecord,
  ChainAddressRepositoryPort,
  CreateChainAddressData,
  UpdateChainAddressData,
} from '../../application/ports/chain-address-repository.port';

function mapAddress(record: {
  id: string;
  chain: ChainNetwork;
  networkId: string;
  walletId: string | null;
  ownerUserId: string;
  address: string;
  label: string | null;
  isPrimary: boolean;
  status: ChainAddressStatus;
  watched: boolean;
  metadata: unknown;
  createdAt: Date;
  updatedAt: Date;
  activatedAt: Date | null;
  archivedAt: Date | null;
}): ChainAddressRecord {
  return {
    id: record.id,
    chain: record.chain,
    networkId: record.networkId,
    walletId: record.walletId,
    ownerUserId: record.ownerUserId,
    address: record.address,
    label: record.label,
    isPrimary: record.isPrimary,
    status: record.status,
    watched: record.watched,
    metadata: record.metadata as ChainAddressRecord['metadata'],
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    activatedAt: record.activatedAt,
    archivedAt: record.archivedAt,
  };
}

@Injectable()
export class PrismaChainAddressRepository implements ChainAddressRepositoryPort {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async create(data: CreateChainAddressData): Promise<ChainAddressRecord> {
    const record = await this.prisma.chainAddress.create({
      data: {
        chain: data.chain,
        networkId: data.networkId,
        walletId: data.walletId ?? null,
        ownerUserId: data.ownerUserId,
        address: data.address,
        label: data.label ?? null,
        metadata: data.metadata,
      },
    });
    return mapAddress(record);
  }

  async findById(id: string): Promise<ChainAddressRecord | null> {
    const record = await this.prisma.chainAddress.findFirst({ where: { id, deletedAt: null } });
    return record ? mapAddress(record) : null;
  }

  async findByChainAddress(chain: ChainNetwork, address: string): Promise<ChainAddressRecord | null> {
    const record = await this.prisma.chainAddress.findFirst({
      where: { chain, address, deletedAt: null },
    });
    return record ? mapAddress(record) : null;
  }

  async list(filters: ChainAddressFilters): Promise<{ items: ChainAddressRecord[]; total: number }> {
    const where = {
      deletedAt: null,
      ...(filters.ownerUserId ? { ownerUserId: filters.ownerUserId } : {}),
      ...(filters.chain ? { chain: filters.chain } : {}),
      ...(filters.status ? { status: filters.status } : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.chainAddress.findMany({
        where,
        skip: filters.skip ?? 0,
        take: filters.take ?? 50,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.chainAddress.count({ where }),
    ]);

    return { items: items.map(mapAddress), total };
  }

  async update(id: string, data: UpdateChainAddressData): Promise<ChainAddressRecord> {
    const record = await this.prisma.chainAddress.update({
      where: { id },
      data: {
        label: data.label,
        metadata: data.metadata,
        watched: data.watched,
      },
    });
    return mapAddress(record);
  }

  async setStatus(id: string, status: ChainAddressStatus): Promise<ChainAddressRecord> {
    const now = new Date();
    const record = await this.prisma.chainAddress.update({
      where: { id },
      data: {
        status,
        activatedAt: status === 'ACTIVE' ? now : undefined,
        archivedAt: status === 'ARCHIVED' ? now : null,
      },
    });
    return mapAddress(record);
  }

  async setPrimary(id: string, ownerUserId: string, chain: ChainNetwork): Promise<ChainAddressRecord> {
    return this.prisma.$transaction(async (tx) => {
      await tx.chainAddress.updateMany({
        where: { ownerUserId, chain, isPrimary: true, deletedAt: null },
        data: { isPrimary: false },
      });
      const record = await tx.chainAddress.update({
        where: { id },
        data: { isPrimary: true },
      });
      return mapAddress(record);
    });
  }

  async listWatched(chain?: ChainNetwork): Promise<ChainAddressRecord[]> {
    const records = await this.prisma.chainAddress.findMany({
      where: {
        watched: true,
        deletedAt: null,
        status: 'ACTIVE',
        ...(chain ? { chain } : {}),
      },
    });
    return records.map(mapAddress);
  }
}
