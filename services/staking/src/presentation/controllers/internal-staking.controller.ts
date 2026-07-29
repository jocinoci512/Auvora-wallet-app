import { Body, Controller, Inject, Post, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { StakingEngineService } from '../../application/services/staking-engine.service';
import { Public, SkipCsrf } from '../decorators/auth.decorators';
import { InternalApiKeyGuard } from '../guards/internal-api-key.guard';
import { successResponse } from '@auvora/nest-common';

@ApiTags('internal-staking')
@Controller('api/v1/internal/staking')
@Public()
@SkipCsrf()
@UseGuards(InternalApiKeyGuard)
export class InternalStakingController {
  constructor(@Inject(StakingEngineService) private readonly engine: StakingEngineService) {}

  @Post('sync-rewards')
  async syncRewards(@Body() body: { userId?: string }) {
    return successResponse(await this.engine.syncPendingRewards(body.userId));
  }
}
