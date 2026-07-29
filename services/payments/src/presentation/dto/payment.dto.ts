import {
  IsEnum,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
} from 'class-validator';
import { PaymentStatus, PaymentType } from '@auvora/database';
import { PaginationQueryDto } from './common.dto';

const DECIMAL_PATTERN = /^\d+(\.\d+)?$/;

export class CreatePaymentDto {
  @IsEnum(PaymentType)
  type!: PaymentType;

  @IsString()
  @Matches(DECIMAL_PATTERN, { message: 'amount must be a positive decimal string' })
  amount!: string;

  @IsString()
  @IsNotEmpty()
  currency!: string;

  @IsOptional()
  @IsString()
  assetCode?: string;

  @IsOptional()
  @IsUUID()
  fromWalletId?: string;

  @IsOptional()
  @IsUUID()
  toWalletId?: string;

  @IsOptional()
  @IsUUID()
  paymentMethodId?: string;

  @IsOptional()
  @IsString()
  idempotencyKey?: string;

  @IsOptional()
  @IsString()
  correlationId?: string;

  @IsOptional()
  @IsString()
  country?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

export class CreateTransferDto {
  @IsUUID()
  fromWalletId!: string;

  @IsUUID()
  toWalletId!: string;

  @IsString()
  @Matches(DECIMAL_PATTERN, { message: 'amount must be a positive decimal string' })
  amount!: string;

  @IsString()
  @IsNotEmpty()
  currency!: string;

  @IsOptional()
  @IsString()
  idempotencyKey?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

export class CreatePaymentRequestDto {
  @IsString()
  @Matches(DECIMAL_PATTERN, { message: 'amount must be a positive decimal string' })
  amount!: string;

  @IsString()
  @IsNotEmpty()
  currency!: string;

  @IsOptional()
  @IsUUID()
  toWalletId?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

export class RefundPaymentDto {
  @IsOptional()
  @IsString()
  @Matches(DECIMAL_PATTERN, { message: 'amount must be a positive decimal string' })
  amount?: string;

  @IsOptional()
  @IsString()
  reason?: string;
}

export class PaymentIdParamDto {
  @IsUUID()
  id!: string;
}

export class SearchPaymentsQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsEnum(PaymentType)
  type?: PaymentType;

  @IsOptional()
  @IsEnum(PaymentStatus)
  status?: PaymentStatus;

  @IsOptional()
  @IsString()
  currency?: string;
}

export class AdminSearchPaymentsQueryDto extends SearchPaymentsQueryDto {
  @IsOptional()
  @IsUUID()
  ownerUserId?: string;
}

export class FlagRiskDto {
  @IsString({ each: true })
  riskFlags!: string[];
}
