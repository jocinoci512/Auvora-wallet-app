import { Body, Controller, Get, Inject, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { type ChainNetwork } from '@auvora/database';
import type { JwtAccessClaims } from '@auvora/types';
import { NftEngineService } from '../../application/services/nft-engine.service';
import { NFT_PERMISSIONS } from '../../domain/permission-codes';
import { Permissions } from '../decorators/auth.decorators';
import { CurrentUser } from '../decorators/current-user.decorator';
import { successResponse } from '@auvora/nest-common';
import {
  type DiscoverNftDto,
  type FavoriteDto,
  type GalleryQueryDto,
  type HiddenDto,
} from '../dto/nft.dto';

@ApiTags('nfts')
@ApiBearerAuth()
@Controller('api/v1/nfts')
export class NftsController {
  constructor(@Inject(NftEngineService) private readonly engine: NftEngineService) {}

  @Get('networks')
  @Permissions(NFT_PERMISSIONS.READ)
  networks() {
    return successResponse(this.engine.listNetworks());
  }

  @Post('discover')
  @Permissions(NFT_PERMISSIONS.WRITE)
  async discover(@CurrentUser() user: JwtAccessClaims, @Body() body: DiscoverNftDto) {
    return successResponse(
      await this.engine.discoverAndSync(user.sub, body.network, body.ownerAddress),
    );
  }

  @Get('gallery')
  @Permissions(NFT_PERMISSIONS.READ)
  async gallery(@CurrentUser() user: JwtAccessClaims, @Query() query: GalleryQueryDto) {
    return successResponse(await this.engine.gallery(user.sub, query));
  }

  @Get('assets/:assetId')
  @Permissions(NFT_PERMISSIONS.READ)
  async detail(@CurrentUser() user: JwtAccessClaims, @Param('assetId') assetId: string) {
    return successResponse(await this.engine.getAssetDetail(user.sub, assetId));
  }

  @Patch('assets/:assetId/favorite')
  @Permissions(NFT_PERMISSIONS.WRITE)
  async favorite(
    @CurrentUser() user: JwtAccessClaims,
    @Param('assetId') assetId: string,
    @Body() body: FavoriteDto,
  ) {
    return successResponse(await this.engine.setFavorite(user.sub, assetId, body.isFavorite));
  }

  @Patch('assets/:assetId/hidden')
  @Permissions(NFT_PERMISSIONS.WRITE)
  async hidden(
    @CurrentUser() user: JwtAccessClaims,
    @Param('assetId') assetId: string,
    @Body() body: HiddenDto,
  ) {
    return successResponse(await this.engine.setHidden(user.sub, assetId, body.isHidden));
  }

  @Post('assets/:assetId/verify-ownership')
  @Permissions(NFT_PERMISSIONS.WRITE)
  async verify(@CurrentUser() user: JwtAccessClaims, @Param('assetId') assetId: string) {
    return successResponse(await this.engine.verifyOwnership(user.sub, assetId));
  }

  @Post('assets/:assetId/refresh-metadata')
  @Permissions(NFT_PERMISSIONS.WRITE)
  async refresh(@Param('assetId') assetId: string) {
    return successResponse(await this.engine.refreshMetadata(assetId));
  }

  @Get('collections')
  @Permissions(NFT_PERMISSIONS.READ)
  async collections(@Query('network') network?: ChainNetwork) {
    return successResponse(await this.engine.listCollections(network));
  }

  @Get('collections/:network/:slug')
  @Permissions(NFT_PERMISSIONS.READ)
  async collection(@Param('network') network: ChainNetwork, @Param('slug') slug: string) {
    return successResponse(await this.engine.getCollection(network, slug));
  }
}
