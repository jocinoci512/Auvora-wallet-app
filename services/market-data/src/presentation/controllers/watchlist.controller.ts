import { Body, Controller, Delete, Get, Inject, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { JwtAccessClaims } from '@auvora/types';
import { IsBoolean, IsOptional, IsString, MinLength } from 'class-validator';
import { WatchlistService } from '../../application/services/watchlist.service';
import {
  PERMISSION_MARKET_DATA_READ,
  PERMISSION_MARKET_DATA_WRITE,
  PERMISSION_MARKET_DATA_ADMIN,
} from '../../domain/permission-codes';
import { successResponse } from '@auvora/nest-common';
import { Permissions } from '../decorators/auth.decorators';
import { CurrentUser } from '../decorators/current-user.decorator';

class AddWatchlistItemDto {
  @IsOptional()
  @IsString()
  metadataId?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  symbol?: string;

  @IsOptional()
  @IsString()
  network?: string;
}

class FlagDto {
  @IsBoolean()
  value!: boolean;
}

@ApiTags('market-data-watchlists')
@ApiBearerAuth()
@Controller('api/v1/market-data/watchlists')
export class WatchlistController {
  constructor(@Inject(WatchlistService) private readonly watchlists: WatchlistService) {}

  @Get()
  @Permissions(PERMISSION_MARKET_DATA_READ)
  async getMine(@CurrentUser() user: JwtAccessClaims) {
    return successResponse(await this.watchlists.getOrCreateDefault(user.sub));
  }

  @Post('items')
  @Permissions(PERMISSION_MARKET_DATA_WRITE)
  async add(@CurrentUser() user: JwtAccessClaims, @Body() body: AddWatchlistItemDto) {
    return successResponse(await this.watchlists.addAsset(user.sub, body));
  }

  @Delete('items/:metadataId')
  @Permissions(PERMISSION_MARKET_DATA_WRITE)
  async remove(@CurrentUser() user: JwtAccessClaims, @Param('metadataId') metadataId: string) {
    return successResponse(await this.watchlists.removeAsset(user.sub, metadataId));
  }

  @Patch('items/:metadataId/favorite')
  @Permissions(PERMISSION_MARKET_DATA_WRITE)
  async favorite(
    @CurrentUser() user: JwtAccessClaims,
    @Param('metadataId') metadataId: string,
    @Body() body: FlagDto,
  ) {
    return successResponse(await this.watchlists.setFavorite(user.sub, metadataId, body.value));
  }

  @Patch('items/:metadataId/pin')
  @Permissions(PERMISSION_MARKET_DATA_WRITE)
  async pin(
    @CurrentUser() user: JwtAccessClaims,
    @Param('metadataId') metadataId: string,
    @Body() body: FlagDto,
  ) {
    return successResponse(await this.watchlists.setPinned(user.sub, metadataId, body.value));
  }

  @Post('sync')
  @Permissions(PERMISSION_MARKET_DATA_WRITE, PERMISSION_MARKET_DATA_ADMIN)
  async sync(
    @CurrentUser() user: JwtAccessClaims,
    @Body() body: { symbols: Array<{ symbol: string; network: string }> },
  ) {
    return successResponse(await this.watchlists.syncFromSymbols(user.sub, body.symbols ?? []));
  }
}
