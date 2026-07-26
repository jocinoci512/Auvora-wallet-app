import { IsObject, IsOptional, IsString, IsUUID, Matches, IsEnum } from 'class-validator';
import { TransactionType } from '@auvora/database';

const DECIMAL_PATTERN = /^\d+(\.\d+)?$/;

export class InternalCreditDebitDto {
  @IsUUID()
  walletId!: string;

  @IsString()
  @Matches(DECIMAL_PATTERN, { message: 'amount must be a positive decimal string' })
  amount!: string;

  /**
   * Required for payment-orchestrated mutations: wallet must belong to this user.
   * Prevents IDOR when the caller authenticates only with the internal API key.
   */
  @IsUUID()
  expectedOwnerUserId!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;

  @IsOptional()
  @IsEnum(TransactionType)
  transactionType?: TransactionType;
}

export class InternalTransferDto {
  @IsUUID()
  fromWalletId!: string;

  @IsUUID()
  toWalletId!: string;

  @IsString()
  @Matches(DECIMAL_PATTERN, { message: 'amount must be a positive decimal string' })
  amount!: string;

  /** Owner of the debit (source) wallet — must match fromWallet.ownerUserId. */
  @IsUUID()
  expectedOwnerUserId!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
