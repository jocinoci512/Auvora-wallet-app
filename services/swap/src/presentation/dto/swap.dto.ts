import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ChainNetwork } from '@auvora/database';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
  MinLength,
} from 'class-validator';

export class SwapQuoteDto {
  @ApiProperty({ enum: ChainNetwork })
  @IsEnum(ChainNetwork)
  network!: ChainNetwork;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  sellToken!: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  buyToken!: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  sellAmount!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(10_000)
  slippageBps?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  userAddress?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  sellContractAddress?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  buyContractAddress?: string;
}

export class PrepareSwapDto {
  @ApiProperty({ enum: ChainNetwork })
  @IsEnum(ChainNetwork)
  network!: ChainNetwork;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  sellToken!: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  buyToken!: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  sellAmount!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(10_000)
  slippageBps?: number;

  @ApiProperty()
  @IsUUID()
  quoteId!: string;

  @ApiProperty()
  @IsString()
  providerCode!: string;

  @ApiProperty()
  @IsString()
  @MinLength(8)
  userAddress!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  sellContractAddress?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  buyContractAddress?: string;
}

export class ExecuteSwapDto {
  @ApiProperty()
  @IsUUID()
  executionId!: string;

  @ApiProperty()
  @IsBoolean()
  confirmed!: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  signedTxHash?: string;
}
