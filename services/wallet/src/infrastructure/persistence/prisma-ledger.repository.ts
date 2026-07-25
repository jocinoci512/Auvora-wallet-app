import { Inject, Injectable } from '@nestjs/common';
import {
  LedgerEntryType,
  Prisma,
  PrismaService,
} from '@auvora/database';
import { ValidationError } from '../../domain';
import type {
  ApplyLedgerEntryInput,
  BalanceAuditRecord,
  BalanceRecord,
  BalanceSnapshotRecord,
  LedgerEntryRecord,
  LedgerRepositoryPort,
} from '../../application/ports/ledger-repository.port';

type Decimal = Prisma.Decimal;

function decimalToString(value: Decimal): string {
  return value.toFixed();
}

function mapBalance(record: {
  id: string;
  walletId: string;
  assetId: string;
  available: Decimal;
  pending: Decimal;
  locked: Decimal;
  reserved: Decimal;
  total: Decimal;
  version: number;
  updatedAt: Date;
}): BalanceRecord {
  return {
    id: record.id,
    walletId: record.walletId,
    assetId: record.assetId,
    available: decimalToString(record.available),
    pending: decimalToString(record.pending),
    locked: decimalToString(record.locked),
    reserved: decimalToString(record.reserved),
    total: decimalToString(record.total),
    version: record.version,
    updatedAt: record.updatedAt,
  };
}

function mapEntry(record: {
  id: string;
  walletId: string;
  assetId: string;
  transactionId: string | null;
  entryType: LedgerEntryType;
  amount: Decimal;
  balanceAfterAvailable: Decimal;
  balanceAfterPending: Decimal;
  balanceAfterLocked: Decimal;
  balanceAfterReserved: Decimal;
  balanceAfterTotal: Decimal;
  reference: string;
  description: string | null;
  metadata: unknown;
  createdAt: Date;
}): LedgerEntryRecord {
  return {
    id: record.id,
    walletId: record.walletId,
    assetId: record.assetId,
    transactionId: record.transactionId,
    entryType: record.entryType,
    amount: decimalToString(record.amount),
    balanceAfterAvailable: decimalToString(record.balanceAfterAvailable),
    balanceAfterPending: decimalToString(record.balanceAfterPending),
    balanceAfterLocked: decimalToString(record.balanceAfterLocked),
    balanceAfterReserved: decimalToString(record.balanceAfterReserved),
    balanceAfterTotal: decimalToString(record.balanceAfterTotal),
    reference: record.reference,
    description: record.description,
    metadata: record.metadata as LedgerEntryRecord['metadata'],
    createdAt: record.createdAt,
  };
}

function computeTotal(available: Decimal, pending: Decimal, locked: Decimal, reserved: Decimal): Decimal {
  return available.add(pending).add(locked).add(reserved);
}

@Injectable()
export class PrismaLedgerRepository implements LedgerRepositoryPort {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async getBalance(walletId: string): Promise<BalanceRecord | null> {
    const balance = await this.prisma.walletBalance.findFirst({
      where: { walletId },
    });
    return balance ? mapBalance(balance) : null;
  }

  async applyEntry(
    input: ApplyLedgerEntryInput,
  ): Promise<{ entry: LedgerEntryRecord; balance: BalanceRecord }> {
    return this.prisma.$transaction(async (tx) => {
      const current = await tx.walletBalance.findFirst({
        where: { walletId: input.walletId, assetId: input.assetId },
      });

      if (!current) {
        throw new ValidationError('Wallet balance not found');
      }

      const amount = new Prisma.Decimal(input.amount);
      let available = new Prisma.Decimal(current.available);
      const pending = new Prisma.Decimal(current.pending);
      const locked = new Prisma.Decimal(current.locked);
      const reserved = new Prisma.Decimal(current.reserved);

      if (input.entryType === LedgerEntryType.CREDIT) {
        available = available.add(amount);
      } else if (input.entryType === LedgerEntryType.DEBIT) {
        if (available.lt(amount)) {
          throw new ValidationError('Insufficient available balance');
        }
        available = available.sub(amount);
      } else {
        throw new ValidationError(`Unsupported ledger entry type: ${input.entryType}`);
      }

      const total = computeTotal(available, pending, locked, reserved);

      const beforeSnapshot = {
        available: decimalToString(new Prisma.Decimal(current.available)),
        pending: decimalToString(pending),
        locked: decimalToString(locked),
        reserved: decimalToString(reserved),
        total: decimalToString(new Prisma.Decimal(current.total)),
      };

      const updated = await tx.walletBalance.update({
        where: { id: current.id, version: current.version },
        data: {
          available,
          total,
          version: { increment: 1 },
        },
      });

      const afterSnapshot = {
        available: decimalToString(available),
        pending: decimalToString(pending),
        locked: decimalToString(locked),
        reserved: decimalToString(reserved),
        total: decimalToString(total),
      };

      const entry = await tx.ledgerEntry.create({
        data: {
          walletId: input.walletId,
          assetId: input.assetId,
          transactionId: input.transactionId ?? null,
          entryType: input.entryType,
          amount,
          balanceAfterAvailable: available,
          balanceAfterPending: pending,
          balanceAfterLocked: locked,
          balanceAfterReserved: reserved,
          balanceAfterTotal: total,
          reference: input.reference,
          description: input.description ?? null,
          metadata: input.metadata,
        },
      });

      await tx.balanceAudit.create({
        data: {
          walletId: input.walletId,
          assetId: input.assetId,
          action: input.entryType,
          before: beforeSnapshot,
          after: afterSnapshot,
          actorId: input.actorId ?? null,
        },
      });

      return {
        entry: mapEntry(entry),
        balance: mapBalance(updated),
      };
    });
  }

  async getEntries(walletId: string, skip = 0, take = 50): Promise<LedgerEntryRecord[]> {
    const entries = await this.prisma.ledgerEntry.findMany({
      where: { walletId },
      skip,
      take,
      orderBy: { createdAt: 'desc' },
    });
    return entries.map(mapEntry);
  }

  async createSnapshot(
    walletId: string,
    reason?: string,
    actorId?: string,
  ): Promise<BalanceSnapshotRecord> {
    const balance = await this.prisma.walletBalance.findFirst({
      where: { walletId },
    });
    if (!balance) {
      throw new ValidationError('Wallet balance not found');
    }

    const snapshot = await this.prisma.balanceSnapshot.create({
      data: {
        walletId,
        assetId: balance.assetId,
        available: balance.available,
        pending: balance.pending,
        locked: balance.locked,
        reserved: balance.reserved,
        total: balance.total,
        reason: reason ?? null,
      },
    });

    if (actorId) {
      await this.prisma.balanceAudit.create({
        data: {
          walletId,
          assetId: balance.assetId,
          action: 'SNAPSHOT',
          before: {
            available: decimalToString(balance.available),
            pending: decimalToString(balance.pending),
            locked: decimalToString(balance.locked),
            reserved: decimalToString(balance.reserved),
            total: decimalToString(balance.total),
          },
          after: {
            available: decimalToString(balance.available),
            pending: decimalToString(balance.pending),
            locked: decimalToString(balance.locked),
            reserved: decimalToString(balance.reserved),
            total: decimalToString(balance.total),
          },
          actorId,
        },
      });
    }

    return {
      id: snapshot.id,
      walletId: snapshot.walletId,
      assetId: snapshot.assetId,
      available: decimalToString(snapshot.available),
      pending: decimalToString(snapshot.pending),
      locked: decimalToString(snapshot.locked),
      reserved: decimalToString(snapshot.reserved),
      total: decimalToString(snapshot.total),
      capturedAt: snapshot.capturedAt,
      reason: snapshot.reason,
    };
  }

  async getSnapshots(walletId: string, skip = 0, take = 50): Promise<BalanceSnapshotRecord[]> {
    const snapshots = await this.prisma.balanceSnapshot.findMany({
      where: { walletId },
      skip,
      take,
      orderBy: { capturedAt: 'desc' },
    });
    return snapshots.map((s) => ({
      id: s.id,
      walletId: s.walletId,
      assetId: s.assetId,
      available: decimalToString(s.available),
      pending: decimalToString(s.pending),
      locked: decimalToString(s.locked),
      reserved: decimalToString(s.reserved),
      total: decimalToString(s.total),
      capturedAt: s.capturedAt,
      reason: s.reason,
    }));
  }

  async getAudits(walletId: string, skip = 0, take = 50): Promise<BalanceAuditRecord[]> {
    const audits = await this.prisma.balanceAudit.findMany({
      where: { walletId },
      skip,
      take,
      orderBy: { createdAt: 'desc' },
    });
    return audits.map((a) => ({
      id: a.id,
      walletId: a.walletId,
      assetId: a.assetId,
      action: a.action,
      before: a.before as BalanceAuditRecord['before'],
      after: a.after as BalanceAuditRecord['after'],
      actorId: a.actorId,
      createdAt: a.createdAt,
    }));
  }
}
