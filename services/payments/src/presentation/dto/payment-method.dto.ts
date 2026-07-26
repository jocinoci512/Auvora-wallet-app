import { Transform } from 'class-transformer';
import { IsBoolean, IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';
import { PaymentMethodType } from '@auvora/database';
import { PaginationQueryDto } from './common.dto';

export class CreatePaymentMethodDto {
  @IsEnum(PaymentMethodType)
  type!: PaymentMethodType;

  @IsOptional()
  @IsString()
  label?: string;

  @IsOptional()
  @IsString()
  last4?: string;

  @IsOptional()
  @IsString()
  country?: string;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}

export class ListPaymentMethodsQueryDto extends PaginationQueryDto {
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  isActive?: boolean;
}

export class PaymentMethodIdParamDto {
  @IsUUID()
  id!: string;
}
