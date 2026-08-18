import { Type } from 'class-transformer';
import {
  IsInt,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { type WalletStatus } from '@auvora/database';

export class CreateWalletDto {
  @IsString()
  @IsNotEmpty()
  assetCode!: string;

  @IsOptional()
  @IsString()
  alias?: string;

  @IsOptional()
  @IsString()
  label?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  preferences?: Record<string, unknown>;
}

export class UpdateWalletDto {
  @IsOptional()
  @IsString()
  alias?: string;

  @IsOptional()
  @IsString()
  label?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  preferences?: Record<string, unknown>;
}

export class WalletIdParamDto {
  @IsUUID()
  walletId!: string;
}

export class StatusChangeDto {
  @IsOptional()
  @IsString()
  reason?: string;
}

export class PrepareTransferDto {
  @IsOptional()
  @IsUUID()
  walletId?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(32)
  assetCode!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(256)
  destinationAddress!: string;

  /** Decimal string in whole-token units. Never a binary float. */
  @IsString()
  @IsNotEmpty()
  @Matches(/^\d+(\.\d+)?$/)
  @MaxLength(80)
  amount!: string;

  @IsOptional()
  @IsString()
  @MaxLength(256)
  fromAddress?: string;

  @IsUUID()
  idempotencyKey!: string;
}

export class CreditDebitDto {
  @IsString()
  @IsNotEmpty()
  amount!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

export class InternalTransferDto {
  @IsUUID()
  toWalletId!: string;

  @IsString()
  @IsNotEmpty()
  amount!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

export class PaginationQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  skip?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  take?: number;
}

export class AdminSearchWalletsQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsUUID()
  ownerUserId?: string;

  @IsOptional()
  @IsString()
  assetCode?: string;

  @IsOptional()
  @IsString()
  status?: WalletStatus;
}

export class SnapshotBalanceDto {
  @IsOptional()
  @IsString()
  reason?: string;
}

export class ListUserWalletsQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsUUID()
  userId?: string;
}
