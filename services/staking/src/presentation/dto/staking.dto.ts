import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ChainNetwork } from '@auvora/database';
import { IsBoolean, IsEnum, IsOptional, IsString, IsUUID, MinLength } from 'class-validator';

export class EstimateStakingDto {
  @ApiProperty({ enum: ChainNetwork })
  @IsEnum(ChainNetwork)
  network!: ChainNetwork;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  assetSymbol!: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  amount!: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  validatorId!: string;
}

export class PrepareStakeDto extends EstimateStakingDto {
  @ApiProperty()
  @IsString()
  @MinLength(8)
  userAddress!: string;
}

export class PrepareUnstakeDto extends PrepareStakeDto {
  @ApiProperty()
  @IsUUID()
  positionId!: string;
}

export class PrepareClaimDto {
  @ApiProperty({ enum: ChainNetwork })
  @IsEnum(ChainNetwork)
  network!: ChainNetwork;

  @ApiProperty()
  @IsString()
  assetSymbol!: string;

  @ApiProperty()
  @IsString()
  validatorId!: string;

  @ApiProperty()
  @IsString()
  @MinLength(8)
  userAddress!: string;

  @ApiProperty()
  @IsUUID()
  positionId!: string;
}

export class ConfirmStakingDto {
  @ApiProperty()
  @IsUUID()
  operationId!: string;

  @ApiProperty()
  @IsBoolean()
  confirmed!: boolean;
}

export class ValidatorQueryDto {
  @ApiProperty({ enum: ChainNetwork })
  @IsEnum(ChainNetwork)
  network!: ChainNetwork;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  q?: string;
}
