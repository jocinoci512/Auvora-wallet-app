import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ChainNetwork } from '@auvora/database';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsISO8601,
  IsOptional,
  IsString,
  IsUUID,
  MinLength,
} from 'class-validator';

export class PairDeviceDto {
  @ApiProperty()
  @IsString()
  @MinLength(3)
  deviceId!: string;
}

export class CreateWcSessionDto {
  @ApiProperty({ enum: ChainNetwork, isArray: true })
  @IsArray()
  @ArrayMinSize(1)
  @IsEnum(ChainNetwork, { each: true })
  networks!: ChainNetwork[];

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  permissions?: string[];
}

export class ApproveSessionDto {
  @ApiProperty({ type: [String] })
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  accounts!: string[];
}

export class ConnectBrowserDto {
  @ApiProperty()
  @IsString()
  @MinLength(2)
  providerId!: string;
}

export class AddWatchAddressDto {
  @ApiProperty({ enum: ChainNetwork })
  @IsEnum(ChainNetwork)
  network!: ChainNetwork;

  @ApiProperty()
  @IsString()
  @MinLength(8)
  address!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  label?: string;
}

export class PrepareSignDto {
  @ApiProperty({ enum: ['HARDWARE', 'WALLETCONNECT', 'BROWSER', 'READONLY'] })
  @IsEnum(['HARDWARE', 'WALLETCONNECT', 'BROWSER', 'READONLY'] as const)
  kind!: 'HARDWARE' | 'WALLETCONNECT' | 'BROWSER' | 'READONLY';

  @ApiProperty()
  @IsString()
  @MinLength(2)
  connectionRef!: string;

  @ApiProperty({ enum: ChainNetwork })
  @IsEnum(ChainNetwork)
  network!: ChainNetwork;

  @ApiProperty({ enum: ['TRANSACTION', 'MESSAGE', 'TYPED_DATA'] })
  @IsEnum(['TRANSACTION', 'MESSAGE', 'TYPED_DATA'] as const)
  payloadType!: 'TRANSACTION' | 'MESSAGE' | 'TYPED_DATA';

  @ApiProperty()
  @IsString()
  @MinLength(1)
  payload!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  feeEstimate?: string;
}

export class ConfirmSignDto {
  @ApiProperty()
  @IsUUID()
  requestId!: string;

  @ApiProperty()
  @IsBoolean()
  confirmed!: boolean;
}

export class CreateDappConnectionRequestDto {
  @ApiProperty({ example: 'https://app.uniswap.org' })
  @IsString()
  @MinLength(8)
  origin!: string;

  @ApiProperty()
  @IsString()
  @MinLength(2)
  name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  iconUrl?: string;

  @ApiProperty({ enum: ChainNetwork, isArray: true })
  @IsArray()
  @ArrayMinSize(1)
  @IsEnum(ChainNetwork, { each: true })
  networks!: ChainNetwork[];

  @ApiProperty({ type: [String] })
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  permissions!: string[];

  @ApiPropertyOptional({ description: 'Client-generated nonce for replay protection' })
  @IsOptional()
  @IsString()
  proposalNonce?: string;
}

export class ApproveDappConnectionRequestDto {
  @ApiProperty({ type: [String] })
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  accounts!: string[];

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  trustDapp?: boolean;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  permissions?: string[];
}

export class UpdateDappPermissionDto {
  @ApiProperty()
  @IsString()
  @MinLength(8)
  origin!: string;

  @ApiProperty()
  @IsString()
  permission!: string;

  @ApiProperty()
  @IsBoolean()
  allowed!: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsISO8601()
  expiresAt?: string;
}

export class VisitDappDto {
  @ApiProperty({ example: 'https://app.example.com/swap' })
  @IsString()
  @MinLength(8)
  url!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  faviconUrl?: string;
}

export class PrepareDappSignDto {
  @ApiProperty()
  @IsString()
  @MinLength(8)
  origin!: string;

  @ApiProperty({ enum: ['HARDWARE', 'WALLETCONNECT', 'BROWSER', 'READONLY'] })
  @IsEnum(['HARDWARE', 'WALLETCONNECT', 'BROWSER', 'READONLY'] as const)
  kind!: 'HARDWARE' | 'WALLETCONNECT' | 'BROWSER' | 'READONLY';

  @ApiProperty()
  @IsString()
  @MinLength(2)
  connectionRef!: string;

  @ApiProperty({ enum: ChainNetwork })
  @IsEnum(ChainNetwork)
  network!: ChainNetwork;

  @ApiProperty({ enum: ['TRANSACTION', 'MESSAGE', 'TYPED_DATA'] })
  @IsEnum(['TRANSACTION', 'MESSAGE', 'TYPED_DATA'] as const)
  payloadType!: 'TRANSACTION' | 'MESSAGE' | 'TYPED_DATA';

  @ApiProperty()
  @IsString()
  @MinLength(1)
  payload!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  feeEstimate?: string;
}
