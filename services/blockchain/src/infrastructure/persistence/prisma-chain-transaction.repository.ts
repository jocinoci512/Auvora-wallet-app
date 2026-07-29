import { Inject, Injectable } from '@nestjs/common';
import {
  type ChainNetwork,
  type ChainTxDirection,
  type ChainTxStatus,
  Prisma,
  PrismaService,
} from '@auvora/database';
import type {
  ChainTransactionFilters,
  ChainTransactionRecord,
  ChainTransactionRepositoryPort,
  CreateChainTransactionData,
  UpdateStatusData,
} from '../../application/ports/chain-transaction-repository.port';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function mapTransaction(record: {
  id: string;
  chain: ChainNetwork;
  networkId: string;
  addressId: string | null;
  txHash: string;
  direction: ChainTxDirection;
  status: ChainTxStatus;
  amount: Prisma.Decimal;
  feeAmount: Prisma.Decimal;
  fromAddress: string | null;
  toAddress: string | null;
  blockNumber: bigint | null;
  confirmations: number;
  requiredConfirmations: number;
  broadcastAt: Date | null;
  confirmedAt: Date | null;
  failedAt: Date | null;
  failureReason: string | null;
  metadata: unknown;
  createdAt: Date;
  updatedAt: Date;
}): ChainTransactionRecord {
  return {
    id: record.id,
    chain: record.chain,
    networkId: record.networkId,
    addressId: record.addressId,
    txHash: record.txHash,
    direction: record.direction,
    status: record.status,
    amount: record.amount.toString(),
    feeAmount: record.feeAmount.toString(),
    fromAddress: record.fromAddress,
    toAddress: record.toAddress,
    blockNumber: record.blockNumber !== null ? record.blockNumber.toString() : null,
    confirmations: record.confirmations,
    requiredConfirmations: record.requiredConfirmations,
    broadcastAt: record.broadcastAt,
    confirmedAt: record.confirmedAt,
    failedAt: record.failedAt,
    failureReason: record.failureReason,
    metadata: record.metadata as ChainTransactionRecord['metadata'],
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

@Injectable()
export class PrismaChainTransactionRepository implements ChainTransactionRepositoryPort {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async create(data: CreateChainTransactionData): Promise<ChainTransactionRecord> {
    const record = await this.prisma.chainTransaction.create({
      data: {
        chain: data.chain,
        networkId: data.networkId,
        addressId: data.addressId ?? null,
        txHash: data.txHash,
        direction: data.direction,
        status: data.status ?? 'PENDING',
        amount: new Prisma.Decimal(data.amount),
        feeAmount: new Prisma.Decimal(data.feeAmount ?? '0'),
        fromAddress: data.fromAddress ?? null,
        toAddress: data.toAddress ?? null,
        requiredConfirmations: data.requiredConfirmations,
        metadata: data.metadata,
        rawPayload: data.rawPayload,
        broadcastAt: data.broadcastAt ?? null,
      },
    });
    return mapTransaction(record);
  }

  async findById(id: string): Promise<ChainTransactionRecord | null> {
    const record = await this.prisma.chainTransaction.findUnique({ where: { id } });
    return record ? mapTransaction(record) : null;
  }

  async findByChainTxHash(
    chain: ChainNetwork,
    txHash: string,
  ): Promise<ChainTransactionRecord | null> {
    const record = await this.prisma.chainTransaction.findUnique({
      where: { chain_txHash: { chain, txHash } },
    });
    return record ? mapTransaction(record) : null;
  }

  async findByIdOrHash(idOrHash: string): Promise<ChainTransactionRecord | null> {
    const record = await this.prisma.chainTransaction.findFirst({
      where: UUID_RE.test(idOrHash)
        ? { OR: [{ id: idOrHash }, { txHash: idOrHash }] }
        : { txHash: idOrHash },
    });
    return record ? mapTransaction(record) : null;
  }

  async list(
    filters: ChainTransactionFilters,
  ): Promise<{ items: ChainTransactionRecord[]; total: number }> {
    const where = {
      ...(filters.chain ? { chain: filters.chain } : {}),
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.statuses ? { status: { in: filters.statuses } } : {}),
      ...(filters.addressId ? { addressId: filters.addressId } : {}),
      ...(filters.ownerUserId ? { address: { ownerUserId: filters.ownerUserId } } : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.chainTransaction.findMany({
        where,
        skip: filters.skip ?? 0,
        take: filters.take ?? 50,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.chainTransaction.count({ where }),
    ]);

    return { items: items.map(mapTransaction), total };
  }

  async updateStatus(
    id: string,
    status: ChainTxStatus,
    data?: UpdateStatusData,
  ): Promise<ChainTransactionRecord> {
    const record = await this.prisma.chainTransaction.update({
      where: { id },
      data: {
        status,
        failureReason: data?.failureReason,
        confirmedAt: data?.confirmedAt,
        failedAt: data?.failedAt,
        broadcastAt: data?.broadcastAt,
      },
    });
    return mapTransaction(record);
  }

  async updateConfirmations(
    id: string,
    confirmations: number,
    blockNumber?: string | null,
  ): Promise<ChainTransactionRecord> {
    const record = await this.prisma.chainTransaction.update({
      where: { id },
      data: {
        confirmations,
        blockNumber:
          blockNumber !== undefined
            ? blockNumber === null
              ? null
              : BigInt(blockNumber)
            : undefined,
      },
    });
    return mapTransaction(record);
  }

  async findActiveByChain(chain: ChainNetwork): Promise<ChainTransactionRecord[]> {
    const records = await this.prisma.chainTransaction.findMany({
      where: { chain, status: { in: ['MEMPOOL', 'PENDING'] } },
      orderBy: { createdAt: 'asc' },
    });
    return records.map(mapTransaction);
  }
}
