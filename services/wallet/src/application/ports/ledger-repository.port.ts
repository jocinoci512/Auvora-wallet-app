import type { LedgerEntryType, Prisma, TransactionStatus, TransactionType } from '@auvora/database';

export const LEDGER_REPOSITORY = Symbol('LEDGER_REPOSITORY');

export interface BalanceRecord {
  id: string;
  walletId: string;
  assetId: string;
  available: string;
  pending: string;
  locked: string;
  reserved: string;
  total: string;
  version: number;
  updatedAt: Date;
}

export interface LedgerEntryRecord {
  id: string;
  walletId: string;
  assetId: string;
  transactionId: string | null;
  entryType: LedgerEntryType;
  amount: string;
  balanceAfterAvailable: string;
  balanceAfterPending: string;
  balanceAfterLocked: string;
  balanceAfterReserved: string;
  balanceAfterTotal: string;
  reference: string;
  description: string | null;
  metadata: Prisma.JsonValue | null;
  createdAt: Date;
}

export interface BalanceSnapshotRecord {
  id: string;
  walletId: string;
  assetId: string;
  available: string;
  pending: string;
  locked: string;
  reserved: string;
  total: string;
  capturedAt: Date;
  reason: string | null;
}

export interface BalanceAuditRecord {
  id: string;
  walletId: string;
  assetId: string;
  action: string;
  before: Prisma.JsonValue;
  after: Prisma.JsonValue;
  actorId: string | null;
  createdAt: Date;
}

export interface ApplyLedgerEntryInput {
  walletId: string;
  assetId: string;
  entryType: LedgerEntryType;
  amount: string;
  reference: string;
  description?: string;
  transactionId?: string;
  actorId?: string;
  metadata?: Prisma.InputJsonValue;
}

export interface LedgerRepositoryPort {
  getBalance(walletId: string): Promise<BalanceRecord | null>;
  applyEntry(
    input: ApplyLedgerEntryInput,
  ): Promise<{ entry: LedgerEntryRecord; balance: BalanceRecord }>;
  /**
   * Apply debit then credit in a single Prisma transaction so internal transfers
   * cannot leave funds in a half-applied state.
   */
  applyTransfer(input: { debit: ApplyLedgerEntryInput; credit: ApplyLedgerEntryInput }): Promise<{
    debit: { entry: LedgerEntryRecord; balance: BalanceRecord };
    credit: { entry: LedgerEntryRecord; balance: BalanceRecord };
  }>;
  getEntries(walletId: string, skip?: number, take?: number): Promise<LedgerEntryRecord[]>;
  createSnapshot(
    walletId: string,
    reason?: string,
    actorId?: string,
  ): Promise<BalanceSnapshotRecord>;
  getSnapshots(walletId: string, skip?: number, take?: number): Promise<BalanceSnapshotRecord[]>;
  getAudits(walletId: string, skip?: number, take?: number): Promise<BalanceAuditRecord[]>;
}

export const TRANSACTION_REPOSITORY = Symbol('TRANSACTION_REPOSITORY');

export interface TransactionRecord {
  id: string;
  reference: string;
  type: TransactionType;
  status: TransactionStatus;
  fromWalletId: string | null;
  toWalletId: string | null;
  assetId: string;
  toAssetId: string | null;
  amount: string;
  feeAmount: string;
  initiatedBy: string | null;
  failureReason: string | null;
  metadata: Prisma.JsonValue | null;
  createdAt: Date;
  updatedAt: Date;
  completedAt: Date | null;
}

export interface CreateTransactionInput {
  reference: string;
  type: TransactionType;
  fromWalletId?: string;
  toWalletId?: string;
  assetId: string;
  toAssetId?: string;
  amount: string;
  feeAmount?: string;
  initiatedBy?: string;
  metadata?: Prisma.InputJsonValue;
}

export interface TransactionRepositoryPort {
  create(input: CreateTransactionInput): Promise<TransactionRecord>;
  complete(id: string): Promise<TransactionRecord>;
  findByWallet(walletId: string, skip?: number, take?: number): Promise<TransactionRecord[]>;
  findById(id: string): Promise<TransactionRecord | null>;
}
