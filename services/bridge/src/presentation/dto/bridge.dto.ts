import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ChainNetwork } from '@auvora/database';
import { IsBoolean, IsEnum, IsOptional, IsString, IsUUID, MinLength } from 'class-validator';

export class BridgeQuoteDto {
  @ApiProperty({ enum: ChainNetwork })
  @IsEnum(ChainNetwork)
  sourceNetwork!: ChainNetwork;

  @ApiProperty({ enum: ChainNetwork })
  @IsEnum(ChainNetwork)
  destinationNetwork!: ChainNetwork;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  assetSymbol!: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  amount!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  sourceAddress?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  destinationAddress?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  contractAddress?: string;
}

export class BridgePrepareDto extends BridgeQuoteDto {
  @ApiProperty()
  @IsUUID()
  quoteId!: string;

  @ApiProperty()
  @IsString()
  @MinLength(2)
  providerCode!: string;
}

export class BridgeConfirmDto {
  @ApiProperty()
  @IsUUID()
  transferId!: string;

  @ApiProperty()
  @IsBoolean()
  confirmed!: boolean;
}
