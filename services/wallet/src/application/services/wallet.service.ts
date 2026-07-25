import { Inject, Injectable } from '@nestjs/common';
import {
  LedgerEntryType,
  Prisma,
  TransactionType,
  WalletStatus,
} from '@auvora/database';
import type { JwtAccessClaims, PermissionCode } from '@auvora/types';
import { assertStatusTransition } from '../../domain/wallet-status-transitions';
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from '../../domain';
import { PERMISSION_WALLETS_ADMIN } from '../../domain/permission-codes';
import { ID_GENERATOR, type IdGeneratorPort } from '../ports/clock.port';
import {
  LEDGER_REPOSITORY,
  TRANSACTION_REPOSITORY,
  type ApplyLedgerEntryInput,
  type BalanceAuditRecord,
  type BalanceRecord,
  type BalanceSnapshotRecord,
  type LedgerEntryRecord,
  type LedgerRepositoryPort,
  type TransactionRecord,
  type TransactionRepositoryPort,
} from '../ports/ledger-repository.port';
import {
  WALLET_REPOSITORY,
  type CreateWalletData,
  type StatusHistoryRecord,
  type UpdateWalletData,
  type WalletRecord,
  type WalletRepositoryPort,
  type WalletSearchFilters,
} from '../ports/wallet-repository.port';

type Decimal = Prisma.Decimal;

function toJsonValue(
  value: Record<string, unknown> | undefined,
): Prisma.InputJsonValue | undefined {
  if (value === undefined) {
    return undefined;
  }
  return value as Prisma.InputJsonValue;
}

export interface CreateWalletInput {
  ownerUserId: string;
  assetCode: string;
  alias?: string;
  label?: string;
  metadata?: Record<string, unknown>;
  preferences?: Record<string, unknown>;
}

export interface UpdateWalletInput {
  alias?: string;
  label?: string;
  metadata?: Record<string, unknown>;
  preferences?: Record<string, unknown>;
}

export interface CreditDebitInput {
  walletId: string;
  amount: string;
  description?: string;
  metadata?: Record<string, unknown>;
}

export interface InternalTransferInput {
  fromWalletId: string;
  toWalletId: string;
  amount: string;
  description?: string;
  metadata?: Record<string, unknown>;
}

@Injectable()
export class WalletService {
  constructor(
    @Inject(WALLET_REPOSITORY) private readonly wallets: WalletRepositoryPort,
    @Inject(LEDGER_REPOSITORY) private readonly ledger: LedgerRepositoryPort,
    @Inject(TRANSACTION_REPOSITORY) private readonly transactions: TransactionRepositoryPort,
    @Inject(ID_GENERATOR) private readonly ids: IdGeneratorPort,
  ) {}

  async createWallet(input: CreateWalletInput): Promise<WalletRecord> {
    const asset = await this.wallets.findAssetByCode(input.assetCode);
    if (!asset) {
      throw new NotFoundError(`Asset not found: ${input.assetCode}`);
    }

    // Empty string (not null) so the DB unique constraint on (owner, asset, alias) works.
    const alias = input.alias?.trim() ? input.alias.trim() : '';
    const existing = await this.wallets.findByOwnerAssetAlias(
      input.ownerUserId,
      asset.id,
      alias,
    );
    if (existing) {
      throw new ConflictError(
        `Wallet already exists for owner, asset ${input.assetCode}, and alias`,
      );
    }

    const data: CreateWalletData = {
      ownerUserId: input.ownerUserId,
      assetId: asset.id,
      alias,
      label: input.label ?? null,
      metadata: toJsonValue(input.metadata),
      preferences: toJsonValue(input.preferences),
    };

    const wallet = await this.wallets.createWithZeroBalance(data);
    return this.wallets.transitionStatus(
      wallet.id,
      WalletStatus.ACTIVE,
      input.ownerUserId,
      'Auto-activated on creation',
    );
  }

  async getWallet(id: string, requester: JwtAccessClaims): Promise<WalletRecord> {
    const wallet = await this.requireWallet(id);
    this.assertOwnershipOrAdmin(wallet, requester);
    return wallet;
  }

  async listWalletsForUser(
    userId: string,
    requester: JwtAccessClaims,
    skip = 0,
    take = 50,
  ): Promise<{ items: WalletRecord[]; total: number }> {
    if (userId !== requester.sub && !this.hasAdminPermission(requester)) {
      throw new ForbiddenError('Access denied');
    }
    return this.wallets.listByOwner(userId, skip, take);
  }

  async searchWallets(
    filters: WalletSearchFilters,
    requester: JwtAccessClaims,
  ): Promise<{ items: WalletRecord[]; total: number }> {
    if (!this.hasAdminPermission(requester)) {
      throw new ForbiddenError('Admin access required');
    }
    return this.wallets.search(filters);
  }

  async updateWallet(
    id: string,
    input: UpdateWalletInput,
    requester: JwtAccessClaims,
  ): Promise<WalletRecord> {
    const wallet = await this.requireWallet(id);
    this.assertOwnershipOrAdmin(wallet, requester);
    this.assertMutable(wallet);

    const data: UpdateWalletData = {};
    if (input.alias !== undefined) data.alias = input.alias;
    if (input.label !== undefined) data.label = input.label;
    if (input.metadata !== undefined) data.metadata = toJsonValue(input.metadata);
    if (input.preferences !== undefined) data.preferences = toJsonValue(input.preferences);

    return this.wallets.update(id, data);
  }

  async activate(id: string, requester: JwtAccessClaims, reason?: string): Promise<WalletRecord> {
    const wallet = await this.requireWallet(id);
    this.assertOwnershipOrAdmin(wallet, requester);
    assertStatusTransition(wallet.status, WalletStatus.ACTIVE);
    return this.wallets.transitionStatus(id, WalletStatus.ACTIVE, requester.sub, reason);
  }

  async suspend(id: string, requester: JwtAccessClaims, reason?: string): Promise<WalletRecord> {
    const wallet = await this.requireWallet(id);
    this.assertOwnershipOrAdmin(wallet, requester);
    assertStatusTransition(wallet.status, WalletStatus.SUSPENDED);
    return this.wallets.transitionStatus(id, WalletStatus.SUSPENDED, requester.sub, reason);
  }

  async archive(id: string, requester: JwtAccessClaims, reason?: string): Promise<WalletRecord> {
    const wallet = await this.requireWallet(id);
    this.assertOwnershipOrAdmin(wallet, requester);
    assertStatusTransition(wallet.status, WalletStatus.ARCHIVED);
    return this.wallets.transitionStatus(id, WalletStatus.ARCHIVED, requester.sub, reason);
  }

  async restore(id: string, requester: JwtAccessClaims, reason?: string): Promise<WalletRecord> {
    const wallet = await this.requireWallet(id);
    this.assertOwnershipOrAdmin(wallet, requester);
    assertStatusTransition(wallet.status, WalletStatus.ACTIVE);
    return this.wallets.transitionStatus(id, WalletStatus.ACTIVE, requester.sub, reason ?? 'Restored');
  }

  async getBalance(walletId: string, requester: JwtAccessClaims): Promise<BalanceRecord> {
    const wallet = await this.requireWallet(walletId);
    this.assertOwnershipOrAdmin(wallet, requester);
    const balance = await this.ledger.getBalance(walletId);
    if (!balance) {
      throw new NotFoundError('Balance not found');
    }
    return balance;
  }

  async getTransactions(
    walletId: string,
    requester: JwtAccessClaims,
    skip = 0,
    take = 50,
  ): Promise<TransactionRecord[]> {
    const wallet = await this.requireWallet(walletId);
    this.assertOwnershipOrAdmin(wallet, requester);
    return this.transactions.findByWallet(walletId, skip, take);
  }

  async adminList(filters: WalletSearchFilters): Promise<{ items: WalletRecord[]; total: number }> {
    return this.wallets.search(filters);
  }

  async adminGet(id: string): Promise<WalletRecord> {
    return this.requireWallet(id);
  }

  async adminSuspend(id: string, actorId: string, reason?: string): Promise<WalletRecord> {
    const wallet = await this.requireWallet(id);
    assertStatusTransition(wallet.status, WalletStatus.SUSPENDED);
    return this.wallets.transitionStatus(id, WalletStatus.SUSPENDED, actorId, reason);
  }

  async adminRestore(id: string, actorId: string, reason?: string): Promise<WalletRecord> {
    const wallet = await this.requireWallet(id);
    assertStatusTransition(wallet.status, WalletStatus.ACTIVE);
    return this.wallets.transitionStatus(id, WalletStatus.ACTIVE, actorId, reason ?? 'Admin restore');
  }

  async adminArchive(id: string, actorId: string, reason?: string): Promise<WalletRecord> {
    const wallet = await this.requireWallet(id);
    assertStatusTransition(wallet.status, WalletStatus.ARCHIVED);
    return this.wallets.transitionStatus(id, WalletStatus.ARCHIVED, actorId, reason);
  }

  async creditWallet(
    input: CreditDebitInput,
    requester: JwtAccessClaims,
  ): Promise<{ entry: LedgerEntryRecord; balance: BalanceRecord; transaction: TransactionRecord }> {
    this.assertSystemOrAdmin(requester);
    const wallet = await this.requireWallet(input.walletId);
    this.assertOperational(wallet);

    const amount = this.parsePositiveAmount(input.amount);
    const reference = this.generateTransactionReference();

    const transaction = await this.transactions.create({
      reference,
      type: TransactionType.ADJUSTMENT,
      toWalletId: wallet.id,
      assetId: wallet.assetId,
      amount: amount.toString(),
      initiatedBy: requester.sub,
      metadata: toJsonValue(input.metadata),
    });

    const entryInput: ApplyLedgerEntryInput = {
      walletId: wallet.id,
      assetId: wallet.assetId,
      entryType: LedgerEntryType.CREDIT,
      amount: amount.toString(),
      reference: `LED-${this.ids.uuid()}`,
      description: input.description ?? `Credit via ${reference}`,
      transactionId: transaction.id,
      actorId: requester.sub,
      metadata: toJsonValue(input.metadata),
    };

    const result = await this.ledger.applyEntry(entryInput);
    await this.transactions.complete(transaction.id);

    return { ...result, transaction };
  }

  async debitWallet(
    input: CreditDebitInput,
    requester: JwtAccessClaims,
  ): Promise<{ entry: LedgerEntryRecord; balance: BalanceRecord; transaction: TransactionRecord }> {
    this.assertSystemOrAdmin(requester);
    const wallet = await this.requireWallet(input.walletId);
    this.assertOperational(wallet);

    const amount = this.parsePositiveAmount(input.amount);
    const reference = this.generateTransactionReference();

    const transaction = await this.transactions.create({
      reference,
      type: TransactionType.ADJUSTMENT,
      fromWalletId: wallet.id,
      assetId: wallet.assetId,
      amount: amount.toString(),
      initiatedBy: requester.sub,
      metadata: toJsonValue(input.metadata),
    });

    const entryInput: ApplyLedgerEntryInput = {
      walletId: wallet.id,
      assetId: wallet.assetId,
      entryType: LedgerEntryType.DEBIT,
      amount: amount.toString(),
      reference: `LED-${this.ids.uuid()}`,
      description: input.description ?? `Debit via ${reference}`,
      transactionId: transaction.id,
      actorId: requester.sub,
      metadata: toJsonValue(input.metadata),
    };

    const result = await this.ledger.applyEntry(entryInput);
    await this.transactions.complete(transaction.id);

    return { ...result, transaction };
  }

  async createInternalTransfer(
    input: InternalTransferInput,
    requester: JwtAccessClaims,
  ): Promise<{ transaction: TransactionRecord; fromEntry: LedgerEntryRecord; toEntry: LedgerEntryRecord }> {
    this.assertSystemOrAdmin(requester);

    if (input.fromWalletId === input.toWalletId) {
      throw new ValidationError('Cannot transfer to the same wallet');
    }

    const fromWallet = await this.requireWallet(input.fromWalletId);
    const toWallet = await this.requireWallet(input.toWalletId);
    this.assertOperational(fromWallet);
    this.assertOperational(toWallet);

    if (fromWallet.assetId !== toWallet.assetId) {
      throw new ValidationError('Cross-asset transfers are not supported');
    }

    const amount = this.parsePositiveAmount(input.amount);
    const reference = this.generateTransactionReference();

    const transaction = await this.transactions.create({
      reference,
      type: TransactionType.INTERNAL_TRANSFER,
      fromWalletId: fromWallet.id,
      toWalletId: toWallet.id,
      assetId: fromWallet.assetId,
      amount: amount.toString(),
      initiatedBy: requester.sub,
      metadata: toJsonValue(input.metadata),
    });

    const debitResult = await this.ledger.applyEntry({
      walletId: fromWallet.id,
      assetId: fromWallet.assetId,
      entryType: LedgerEntryType.DEBIT,
      amount: amount.toString(),
      reference: `LED-${this.ids.uuid()}`,
      description: input.description ?? `Transfer out ${reference}`,
      transactionId: transaction.id,
      actorId: requester.sub,
    });

    const creditResult = await this.ledger.applyEntry({
      walletId: toWallet.id,
      assetId: toWallet.assetId,
      entryType: LedgerEntryType.CREDIT,
      amount: amount.toString(),
      reference: `LED-${this.ids.uuid()}`,
      description: input.description ?? `Transfer in ${reference}`,
      transactionId: transaction.id,
      actorId: requester.sub,
    });

    const completed = await this.transactions.complete(transaction.id);

    return {
      transaction: completed,
      fromEntry: debitResult.entry,
      toEntry: creditResult.entry,
    };
  }

  async snapshotBalance(
    walletId: string,
    requester: JwtAccessClaims,
    reason?: string,
  ): Promise<BalanceSnapshotRecord> {
    const wallet = await this.requireWallet(walletId);
    this.assertOwnershipOrAdmin(wallet, requester);
    return this.ledger.createSnapshot(walletId, reason, requester.sub);
  }

  async getBalanceHistory(
    walletId: string,
    requester: JwtAccessClaims,
    skip = 0,
    take = 50,
  ): Promise<BalanceSnapshotRecord[]> {
    const wallet = await this.requireWallet(walletId);
    this.assertOwnershipOrAdmin(wallet, requester);
    return this.ledger.getSnapshots(walletId, skip, take);
  }

  async getBalanceAudits(
    walletId: string,
    requester: JwtAccessClaims,
    skip = 0,
    take = 50,
  ): Promise<BalanceAuditRecord[]> {
    const wallet = await this.requireWallet(walletId);
    this.assertOwnershipOrAdmin(wallet, requester);
    return this.ledger.getAudits(walletId, skip, take);
  }

  async getStatusHistory(
    walletId: string,
    requester: JwtAccessClaims,
    skip = 0,
    take = 50,
  ): Promise<StatusHistoryRecord[]> {
    const wallet = await this.requireWallet(walletId);
    this.assertOwnershipOrAdmin(wallet, requester);
    return this.wallets.getStatusHistory(walletId, skip, take);
  }

  private async requireWallet(id: string): Promise<WalletRecord> {
    const wallet = await this.wallets.findById(id);
    if (!wallet) {
      throw new NotFoundError('Wallet not found');
    }
    return wallet;
  }

  private assertOwnershipOrAdmin(wallet: WalletRecord, requester: JwtAccessClaims): void {
    if (wallet.ownerUserId !== requester.sub && !this.hasAdminPermission(requester)) {
      throw new ForbiddenError('Access denied');
    }
  }

  private assertSystemOrAdmin(requester: JwtAccessClaims): void {
    if (!this.hasAdminPermission(requester)) {
      throw new ForbiddenError('Admin access required');
    }
  }

  private hasAdminPermission(requester: JwtAccessClaims): boolean {
    return requester.permissions.includes(PERMISSION_WALLETS_ADMIN as PermissionCode);
  }

  private assertMutable(wallet: WalletRecord): void {
    if (wallet.status === WalletStatus.ARCHIVED) {
      throw new ValidationError('Cannot modify an archived wallet');
    }
  }

  private assertOperational(wallet: WalletRecord): void {
    if (wallet.status !== WalletStatus.ACTIVE) {
      throw new ValidationError(`Wallet must be ACTIVE, current status: ${wallet.status}`);
    }
  }

  private parsePositiveAmount(amount: string): Decimal {
    let decimal: Decimal;
    try {
      decimal = new Prisma.Decimal(amount);
    } catch {
      throw new ValidationError('Invalid amount');
    }
    if (decimal.lte(0)) {
      throw new ValidationError('Amount must be positive');
    }
    return decimal;
  }

  private generateTransactionReference(): string {
    return `WTX-${this.ids.uuid()}`;
  }
}
