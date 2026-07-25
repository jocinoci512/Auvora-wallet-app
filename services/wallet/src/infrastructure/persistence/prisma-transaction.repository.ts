import { Inject, Injectable } from '@nestjs/common';
import { Prisma, PrismaService, TransactionStatus, type TransactionType } from '@auvora/database';
import type {
  CreateTransactionInput,
  TransactionRecord,
  TransactionRepositoryPort,
} from '../../application/ports/ledger-repository.port';

type Decimal = Prisma.Decimal;

function decimalToString(value: Decimal): string {
  return value.toFixed();
}

function mapTransaction(tx: {
  id: string;
  reference: string;
  type: TransactionType;
  status: TransactionStatus;
  fromWalletId: string | null;
  toWalletId: string | null;
  assetId: string;
  toAssetId: string | null;
  amount: Decimal;
  feeAmount: Decimal;
  initiatedBy: string | null;
  failureReason: string | null;
  metadata: unknown;
  createdAt: Date;
  updatedAt: Date;
  completedAt: Date | null;
}): TransactionRecord {
  return {
    id: tx.id,
    reference: tx.reference,
    type: tx.type,
    status: tx.status,
    fromWalletId: tx.fromWalletId,
    toWalletId: tx.toWalletId,
    assetId: tx.assetId,
    toAssetId: tx.toAssetId,
    amount: decimalToString(tx.amount),
    feeAmount: decimalToString(tx.feeAmount),
    initiatedBy: tx.initiatedBy,
    failureReason: tx.failureReason,
    metadata: tx.metadata as TransactionRecord['metadata'],
    createdAt: tx.createdAt,
    updatedAt: tx.updatedAt,
    completedAt: tx.completedAt,
  };
}

@Injectable()
export class PrismaTransactionRepository implements TransactionRepositoryPort {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async create(input: CreateTransactionInput): Promise<TransactionRecord> {
    const tx = await this.prisma.walletTransaction.create({
      data: {
        reference: input.reference,
        type: input.type,
        status: TransactionStatus.PENDING,
        fromWalletId: input.fromWalletId ?? null,
        toWalletId: input.toWalletId ?? null,
        assetId: input.assetId,
        toAssetId: input.toAssetId ?? null,
        amount: new Prisma.Decimal(input.amount),
        feeAmount: new Prisma.Decimal(input.feeAmount ?? '0'),
        initiatedBy: input.initiatedBy ?? null,
        metadata: input.metadata,
      },
    });
    return mapTransaction(tx);
  }

  async complete(id: string): Promise<TransactionRecord> {
    const tx = await this.prisma.walletTransaction.update({
      where: { id },
      data: {
        status: TransactionStatus.COMPLETED,
        completedAt: new Date(),
      },
    });
    return mapTransaction(tx);
  }

  async findByWallet(walletId: string, skip = 0, take = 50): Promise<TransactionRecord[]> {
    const transactions = await this.prisma.walletTransaction.findMany({
      where: {
        OR: [{ fromWalletId: walletId }, { toWalletId: walletId }],
      },
      skip,
      take,
      orderBy: { createdAt: 'desc' },
    });
    return transactions.map(mapTransaction);
  }

  async findById(id: string): Promise<TransactionRecord | null> {
    const tx = await this.prisma.walletTransaction.findUnique({ where: { id } });
    return tx ? mapTransaction(tx) : null;
  }
}
