import { Body, Controller, Get, Inject, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { type ChainNetwork } from '@auvora/database';
import type { JwtAccessClaims } from '@auvora/types';
import { StakingEngineService } from '../../application/services/staking-engine.service';
import { STAKING_PERMISSIONS } from '../../domain/permission-codes';
import { Permissions } from '../decorators/auth.decorators';
import { CurrentUser } from '../decorators/current-user.decorator';
import { successResponse } from '@auvora/nest-common';
import {
  type ConfirmStakingDto,
  type EstimateStakingDto,
  type PrepareClaimDto,
  type PrepareStakeDto,
  type PrepareUnstakeDto,
} from '../dto/staking.dto';

@ApiTags('staking')
@ApiBearerAuth()
@Controller('api/v1/staking')
export class StakingController {
  constructor(@Inject(StakingEngineService) private readonly engine: StakingEngineService) {}

  @Get('networks')
  @Permissions(STAKING_PERMISSIONS.READ)
  networks() {
    return successResponse(this.engine.listNetworks());
  }

  @Get('validators')
  @Permissions(STAKING_PERMISSIONS.READ)
  async validators(@Query('network') network: ChainNetwork, @Query('q') q?: string) {
    return successResponse(await this.engine.listValidators(network, q));
  }

  @Get('validators/:network/:validatorId')
  @Permissions(STAKING_PERMISSIONS.READ)
  async validator(
    @Param('network') network: ChainNetwork,
    @Param('validatorId') validatorId: string,
  ) {
    return successResponse(await this.engine.getValidator(network, validatorId));
  }

  @Post('estimate')
  @Permissions(STAKING_PERMISSIONS.READ)
  async estimate(@Body() body: EstimateStakingDto) {
    return successResponse(await this.engine.estimate(body));
  }

  @Post('stake/prepare')
  @Permissions(STAKING_PERMISSIONS.WRITE)
  async prepareStake(@CurrentUser() user: JwtAccessClaims, @Body() body: PrepareStakeDto) {
    return successResponse(await this.engine.prepareStake(user.sub, body));
  }

  @Post('unstake/prepare')
  @Permissions(STAKING_PERMISSIONS.WRITE)
  async prepareUnstake(@CurrentUser() user: JwtAccessClaims, @Body() body: PrepareUnstakeDto) {
    return successResponse(await this.engine.prepareUnstake(user.sub, body));
  }

  @Post('claim/prepare')
  @Permissions(STAKING_PERMISSIONS.WRITE)
  async prepareClaim(@CurrentUser() user: JwtAccessClaims, @Body() body: PrepareClaimDto) {
    return successResponse(await this.engine.prepareClaim(user.sub, body));
  }

  @Post('confirm')
  @Permissions(STAKING_PERMISSIONS.WRITE)
  async confirm(@CurrentUser() user: JwtAccessClaims, @Body() body: ConfirmStakingDto) {
    return successResponse(
      await this.engine.confirmAndExecute(user.sub, body.operationId, body.confirmed),
    );
  }

  @Get('operations/pending')
  @Permissions(STAKING_PERMISSIONS.READ)
  async pending(@CurrentUser() user: JwtAccessClaims) {
    return successResponse(await this.engine.pendingOperations(user.sub));
  }

  @Get('operations/:operationId')
  @Permissions(STAKING_PERMISSIONS.READ)
  async operation(@CurrentUser() user: JwtAccessClaims, @Param('operationId') operationId: string) {
    return successResponse(await this.engine.getOperation(user.sub, operationId));
  }

  @Get('positions')
  @Permissions(STAKING_PERMISSIONS.READ)
  async positions(@CurrentUser() user: JwtAccessClaims, @Query('network') network?: ChainNetwork) {
    return successResponse(await this.engine.listPositions(user.sub, network));
  }

  @Get('positions/:positionId')
  @Permissions(STAKING_PERMISSIONS.READ)
  async position(@CurrentUser() user: JwtAccessClaims, @Param('positionId') positionId: string) {
    return successResponse(await this.engine.getPosition(user.sub, positionId));
  }

  @Get('rewards')
  @Permissions(STAKING_PERMISSIONS.READ)
  async rewards(@CurrentUser() user: JwtAccessClaims, @Query('positionId') positionId?: string) {
    return successResponse(await this.engine.rewardHistory(user.sub, positionId));
  }

  @Get('analytics')
  @Permissions(STAKING_PERMISSIONS.READ)
  async analytics(@CurrentUser() user: JwtAccessClaims) {
    return successResponse(await this.engine.yieldAnalytics(user.sub));
  }
}
