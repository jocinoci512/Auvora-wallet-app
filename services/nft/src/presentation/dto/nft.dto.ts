import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ChainNetwork } from '@auvora/database';
import { Transform } from 'class-transformer';
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

const toBoolean = ({ value }: { value: unknown }) => {
  if (value === true || value === 'true' || value === '1') return true;
  if (value === false || value === 'false' || value === '0') return false;
  return value;
};

export class DiscoverNftDto {
  @ApiProperty({ enum: ChainNetwork })
  @IsEnum(ChainNetwork)
  network!: ChainNetwork;

  @ApiProperty()
  @IsString()
  @MinLength(8)
  ownerAddress!: string;
}

export class GalleryQueryDto {
  @ApiPropertyOptional({ enum: ChainNetwork })
  @IsOptional()
  @IsEnum(ChainNetwork)
  network?: ChainNetwork;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  collectionSlug?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  q?: string;

  @ApiPropertyOptional({ enum: ['name_asc', 'name_desc', 'recent', 'token_asc'] })
  @IsOptional()
  @IsString()
  sort?: 'name_asc' | 'name_desc' | 'recent' | 'token_asc';

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  favoritesOnly?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  includeHidden?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) =>
    value === undefined || value === null || value === '' ? undefined : Number(value),
  )
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}

export class FavoriteDto {
  @ApiProperty()
  @IsBoolean()
  isFavorite!: boolean;
}

export class HiddenDto {
  @ApiProperty()
  @IsBoolean()
  isHidden!: boolean;
}

export class AssetIdParamDto {
  @ApiProperty()
  @IsUUID()
  assetId!: string;
}
