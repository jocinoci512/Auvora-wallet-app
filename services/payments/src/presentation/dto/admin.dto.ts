import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
} from 'class-validator';
import {
  ChargebackStatus,
  DisputeStatus,
  LimitWindow,
  PaymentStatus,
  ReconciliationStatus,
  SettlementMode,
  SettlementStatus,
} from '@auvora/database';
import { PaginationQueryDto } from './common.dto';

const DECIMAL_PATTERN = /^\d+(\.\d+)?$/;

export class AdminListHealthQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  providerCode?: string;
}

export class AdminListRefundsQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsUUID()
  paymentId?: string;

  @IsOptional()
  @IsEnum(PaymentStatus)
  status?: PaymentStatus;
}

export class AdminListDisputesQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsEnum(DisputeStatus)
  status?: DisputeStatus;

  @IsOptional()
  @IsUUID()
  paymentId?: string;
}

export class AdminListChargebacksQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsEnum(ChargebackStatus)
  status?: ChargebackStatus;

  @IsOptional()
  @IsUUID()
  paymentId?: string;
}

export class AdminListReconciliationQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsEnum(ReconciliationStatus)
  status?: ReconciliationStatus;

  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  requiresManualReview?: boolean;
}

export class AdminListSettlementsQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsUUID()
  batchId?: string;

  @IsOptional()
  @IsUUID()
  paymentId?: string;

  @IsOptional()
  @IsEnum(SettlementStatus)
  status?: SettlementStatus;
}

export class AdminListSettlementBatchesQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsEnum(SettlementStatus)
  status?: SettlementStatus;

  @IsOptional()
  @IsEnum(SettlementMode)
  mode?: SettlementMode;
}

export class RunSettlementDto {
  @IsIn(['instant', 'manual', 'daily'])
  mode!: 'instant' | 'manual' | 'daily';

  @IsOptional()
  @IsUUID()
  paymentId?: string;

  @IsOptional()
  @IsUUID('4', { each: true })
  paymentIds?: string[];
}

export class CreateLimitDto {
  @IsEnum(LimitWindow)
  window!: LimitWindow;

  @IsString()
  @Matches(DECIMAL_PATTERN, { message: 'amount must be a positive decimal string' })
  amount!: string;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsOptional()
  @IsString()
  assetCode?: string;

  @IsOptional()
  @IsUUID()
  ownerUserId?: string;

  @IsOptional()
  @IsString()
  accountTier?: string;

  @IsOptional()
  @IsString()
  country?: string;

  @IsOptional()
  @IsString()
  riskProfile?: string;

  @IsOptional()
  @IsBoolean()
  isEnabled?: boolean;
}

export class UpdateLimitDto {
  @IsOptional()
  @IsString()
  @Matches(DECIMAL_PATTERN, { message: 'amount must be a positive decimal string' })
  amount?: string;

  @IsOptional()
  @IsBoolean()
  isEnabled?: boolean;
}

export class AdminListLimitsQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsUUID()
  ownerUserId?: string;

  @IsOptional()
  @IsString()
  accountTier?: string;

  @IsOptional()
  @IsString()
  country?: string;

  @IsOptional()
  @IsString()
  riskProfile?: string;

  @IsOptional()
  @IsEnum(LimitWindow)
  window?: LimitWindow;
}

export class LimitIdParamDto {
  @IsUUID()
  id!: string;
}

export class ReconciliationIdParamDto {
  @IsUUID()
  id!: string;
}

export class ResolveReconciliationDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  note?: string;
}
