import { IsEnum, IsNotEmpty, IsObject, IsOptional, IsString, IsUUID } from 'class-validator';
import { ChainAddressStatus, ChainNetwork } from '@auvora/database';
import { PaginationQueryDto } from './common.dto';

export class CreateAddressDto {
  @IsEnum(ChainNetwork)
  chain!: ChainNetwork;

  @IsOptional()
  @IsUUID()
  walletId?: string;

  @IsOptional()
  @IsString()
  label?: string;
}

export class UpdateAddressDto {
  @IsOptional()
  @IsString()
  label?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

export class AddressIdParamDto {
  @IsUUID()
  id!: string;
}

export class ValidateAddressDto {
  @IsEnum(ChainNetwork)
  chain!: ChainNetwork;

  @IsString()
  @IsNotEmpty()
  address!: string;
}

export class ListAddressesQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsEnum(ChainNetwork)
  chain?: ChainNetwork;

  @IsOptional()
  @IsEnum(ChainAddressStatus)
  status?: ChainAddressStatus;
}

export class AdminListAddressesQueryDto extends ListAddressesQueryDto {
  @IsOptional()
  @IsUUID()
  ownerUserId?: string;
}

export class ChainAddressParamsDto {
  @IsEnum(ChainNetwork)
  chain!: ChainNetwork;

  @IsString()
  @IsNotEmpty()
  address!: string;
}

export class ChainParamDto {
  @IsEnum(ChainNetwork)
  chain!: ChainNetwork;
}
