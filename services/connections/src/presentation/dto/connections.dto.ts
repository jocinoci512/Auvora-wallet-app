import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ChainNetwork } from '@auvora/database';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsISO8601,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';

export class PairDeviceDto {
  @ApiProperty()
  @IsString()
  @MinLength(3)
  @MaxLength(200)
  deviceId!: string;
}

export class CreateWcSessionDto {
  @ApiProperty({ enum: ChainNetwork, isArray: true })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(20)
  @IsEnum(ChainNetwork, { each: true })
  networks!: ChainNetwork[];

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  @MaxLength(100, { each: true })
  permissions?: string[];
}

export class ApproveSessionDto {
  @ApiProperty({ type: [String] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @IsString({ each: true })
  @MaxLength(200, { each: true })
  accounts!: string[];
}

export class ConnectBrowserDto {
  @ApiProperty()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  providerId!: string;
}

export class AddWatchAddressDto {
  @ApiProperty({ enum: ChainNetwork })
  @IsEnum(ChainNetwork)
  network!: ChainNetwork;

  @ApiProperty()
  @IsString()
  @MinLength(8)
  @MaxLength(200)
  address!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  label?: string;
}

export class CreateOwnershipChallengeDto {
  @ApiProperty({ enum: ChainNetwork })
  @IsEnum(ChainNetwork)
  network!: ChainNetwork;

  @ApiProperty()
  @IsString()
  @MinLength(8)
  @MaxLength(200)
  address!: string;
}

export class VerifyOwnershipChallengeDto {
  // Ownership challenge ids are server-generated UUIDs (randomUUID + @db.Uuid), so
  // enforce the exact format — this also blocks malformed input from reaching the
  // uuid-typed DB column.
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  challengeId!: string;

  @ApiProperty({ description: 'personal_sign hex signature — never a seed or private key' })
  @IsString()
  @MinLength(80)
  @MaxLength(2000)
  signature!: string;
}

export class PrepareSignDto {
  @ApiProperty({ enum: ['HARDWARE', 'WALLETCONNECT', 'BROWSER', 'READONLY'] })
  @IsEnum(['HARDWARE', 'WALLETCONNECT', 'BROWSER', 'READONLY'] as const)
  kind!: 'HARDWARE' | 'WALLETCONNECT' | 'BROWSER' | 'READONLY';

  @ApiProperty()
  @IsString()
  @MinLength(2)
  @MaxLength(200)
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
  @MaxLength(100_000)
  payload!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
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
  @MaxLength(2048)
  origin!: string;

  @ApiProperty()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2048)
  iconUrl?: string;

  @ApiProperty({ enum: ChainNetwork, isArray: true })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(20)
  @IsEnum(ChainNetwork, { each: true })
  networks!: ChainNetwork[];

  @ApiProperty({ type: [String] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @IsString({ each: true })
  @MaxLength(64, { each: true })
  permissions!: string[];

  @ApiPropertyOptional({ description: 'Client-generated nonce for replay protection' })
  @IsOptional()
  @IsString()
  @MaxLength(128)
  proposalNonce?: string;
}

export class ApproveDappConnectionRequestDto {
  @ApiProperty({ type: [String] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @IsString({ each: true })
  @MaxLength(200, { each: true })
  accounts!: string[];

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  trustDapp?: boolean;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  @MaxLength(64, { each: true })
  permissions?: string[];
}

export class UpdateDappPermissionDto {
  @ApiProperty()
  @IsString()
  @MinLength(8)
  @MaxLength(2048)
  origin!: string;

  @ApiProperty()
  @IsString()
  @MaxLength(64)
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
  @MaxLength(2048)
  url!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2048)
  faviconUrl?: string;
}

export class PrepareDappSignDto {
  @ApiProperty()
  @IsString()
  @MinLength(8)
  @MaxLength(2048)
  origin!: string;

  @ApiProperty({ enum: ['HARDWARE', 'WALLETCONNECT', 'BROWSER', 'READONLY'] })
  @IsEnum(['HARDWARE', 'WALLETCONNECT', 'BROWSER', 'READONLY'] as const)
  kind!: 'HARDWARE' | 'WALLETCONNECT' | 'BROWSER' | 'READONLY';

  @ApiProperty()
  @IsString()
  @MinLength(2)
  @MaxLength(200)
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
  @MaxLength(100_000)
  payload!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  feeEstimate?: string;
}
