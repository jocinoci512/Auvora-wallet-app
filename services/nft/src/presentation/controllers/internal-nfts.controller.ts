import { Body, Controller, Inject, Post, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { type ChainNetwork } from '@auvora/database';
import { NftEngineService } from '../../application/services/nft-engine.service';
import { Public, SkipCsrf } from '../decorators/auth.decorators';
import { InternalApiKeyGuard } from '../guards/internal-api-key.guard';
import { successResponse } from '@auvora/nest-common';

@ApiTags('internal-nfts')
@Controller('api/v1/internal/nfts')
@Public()
@SkipCsrf()
@UseGuards(InternalApiKeyGuard)
export class InternalNftsController {
  constructor(@Inject(NftEngineService) private readonly engine: NftEngineService) {}

  @Post('discover')
  async discover(@Body() body: { userId: string; network: ChainNetwork; ownerAddress: string }) {
    return successResponse(
      await this.engine.discoverAndSync(body.userId, body.network, body.ownerAddress),
    );
  }
}
