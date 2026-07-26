import { Inject, Injectable } from '@nestjs/common';
import { type ChainNetwork, PrismaService } from '@auvora/database';
import type {
  ChainBlockFilters,
  ChainBlockRecord,
  ChainBlockRepositoryPort,
  CreateChainBlockData,
} from '../../application/ports/chain-block-repository.port';

function mapBlock(record: {
  id: string;
  chain: ChainNetwork;
  networkId: string;
  height: bigint;
  hash: string;
  parentHash: string | null;
  timestamp: Date;
  isOrphan: boolean;
  syncedAt: Date;
}): ChainBlockRecord {
  return {
    id: record.id,
    chain: record.chain,
    networkId: record.networkId,
    height: record.height.toString(),
    hash: record.hash,
    parentHash: record.parentHash,
    timestamp: record.timestamp,
    isOrphan: record.isOrphan,
    syncedAt: record.syncedAt,
  };
}

@Injectable()
export class PrismaChainBlockRepository implements ChainBlockRepositoryPort {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async create(data: CreateChainBlockData): Promise<ChainBlockRecord> {
    const record = await this.prisma.chainBlock.create({
      data: {
        chain: data.chain,
        networkId: data.networkId,
        height: BigInt(data.height),
        hash: data.hash,
        parentHash: data.parentHash ?? null,
        timestamp: data.timestamp,
        isOrphan: data.isOrphan ?? false,
      },
    });
    return mapBlock(record);
  }

  async findLatest(chain: ChainNetwork): Promise<ChainBlockRecord | null> {
    const record = await this.prisma.chainBlock.findFirst({
      where: { chain, isOrphan: false },
      orderBy: { height: 'desc' },
    });
    return record ? mapBlock(record) : null;
  }

  async list(filters: ChainBlockFilters): Promise<{ items: ChainBlockRecord[]; total: number }> {
    const where = { ...(filters.chain ? { chain: filters.chain } : {}) };
    const [items, total] = await Promise.all([
      this.prisma.chainBlock.findMany({
        where,
        skip: filters.skip ?? 0,
        take: filters.take ?? 50,
        orderBy: { height: 'desc' },
      }),
      this.prisma.chainBlock.count({ where }),
    ]);
    return { items: items.map(mapBlock), total };
  }

  async markOrphan(id: string): Promise<ChainBlockRecord> {
    const record = await this.prisma.chainBlock.update({
      where: { id },
      data: { isOrphan: true },
    });
    return mapBlock(record);
  }
}
