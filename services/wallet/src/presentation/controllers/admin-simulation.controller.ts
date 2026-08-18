import { Body, Controller, Delete, Get, Inject, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { JwtAccessClaims } from '@auvora/types';
import { successResponse } from '@auvora/nest-common';
import { AdminSimulationService } from '../../application/services/admin-simulation.service';
import {
  ADMIN_PORTAL_ROLES,
  PERMISSION_SIMULATION_MANAGE,
  PERMISSION_SIMULATION_READ,
  PERMISSION_TRANSACTIONS_REVIEW_LARGE,
} from '../../domain/permission-codes';
import { CurrentUser } from '../decorators/current-user.decorator';
import { Permissions, RequireStepUp, Roles } from '../decorators/auth.decorators';
import {
  AdminListReviewsQueryDto,
  AdminReasonDto,
  AssetCodeParamDto,
  CreateSimulationTransactionDto,
  ReviewDecisionDto,
  ReviewIdParamDto,
  SimulationPresetParamDto,
  UpsertSimulationBalanceDto,
  UserIdParamDto,
} from '../dto/admin-simulation.dto';

@ApiTags('admin-simulation')
@ApiBearerAuth()
@Roles(...ADMIN_PORTAL_ROLES)
@Controller('api/v1/admin')
export class AdminSimulationController {
  constructor(
    @Inject(AdminSimulationService) private readonly simulation: AdminSimulationService,
  ) {}

  @Get('simulation/assets')
  @Permissions(PERMISSION_SIMULATION_READ)
  async assets(): Promise<unknown> {
    return successResponse(await this.simulation.listActiveAssets());
  }

  @Get('simulation/accounts')
  @Permissions(PERMISSION_SIMULATION_READ)
  async accounts(@Query('query') query?: string): Promise<unknown> {
    return successResponse(await this.simulation.listSimulationAccounts(query));
  }

  @Get('simulation/accounts/:userId')
  @Permissions(PERMISSION_SIMULATION_READ)
  async getAccount(@Param() params: UserIdParamDto): Promise<unknown> {
    return successResponse(await this.simulation.getSimulationAccount(params.userId));
  }

  @Post('simulation/accounts/:userId/enable')
  @Permissions(PERMISSION_SIMULATION_MANAGE)
  @RequireStepUp()
  async enable(
    @Param() params: UserIdParamDto,
    @Body() dto: AdminReasonDto,
    @CurrentUser() actor: JwtAccessClaims,
  ): Promise<unknown> {
    return successResponse(
      await this.simulation.enableTestAccount(params.userId, actor.sub, dto.reason),
    );
  }

  @Post('simulation/accounts/:userId/disable')
  @Permissions(PERMISSION_SIMULATION_MANAGE)
  @RequireStepUp()
  async disable(
    @Param() params: UserIdParamDto,
    @Body() dto: AdminReasonDto,
    @CurrentUser() actor: JwtAccessClaims,
  ): Promise<unknown> {
    return successResponse(
      await this.simulation.disableTestAccount(params.userId, actor.sub, dto.reason),
    );
  }

  @Post('simulation/accounts/:userId/balances')
  @Permissions(PERMISSION_SIMULATION_MANAGE)
  @RequireStepUp()
  async upsertBalance(
    @Param() params: UserIdParamDto,
    @Body() dto: UpsertSimulationBalanceDto,
    @CurrentUser() actor: JwtAccessClaims,
  ): Promise<unknown> {
    return successResponse(
      await this.simulation.upsertBalance({
        ownerUserId: params.userId,
        assetCode: dto.assetCode,
        operation: dto.operation,
        amount: dto.amount,
        actorUserId: actor.sub,
        reason: dto.reason,
      }),
    );
  }

  @Delete('simulation/accounts/:userId/balances/:assetCode')
  @Permissions(PERMISSION_SIMULATION_MANAGE)
  @RequireStepUp()
  async removeBalance(
    @Param() user: UserIdParamDto,
    @Param() asset: AssetCodeParamDto,
    @Body() dto: AdminReasonDto,
    @CurrentUser() actor: JwtAccessClaims,
  ): Promise<unknown> {
    return successResponse(
      await this.simulation.removeBalance(user.userId, asset.assetCode, actor.sub, dto.reason),
    );
  }

  @Post('simulation/accounts/:userId/reset')
  @Permissions(PERMISSION_SIMULATION_MANAGE)
  @RequireStepUp()
  async reset(
    @Param() params: UserIdParamDto,
    @Body() dto: AdminReasonDto,
    @CurrentUser() actor: JwtAccessClaims,
  ): Promise<unknown> {
    return successResponse(
      await this.simulation.resetPortfolio(params.userId, actor.sub, dto.reason),
    );
  }

  @Post('simulation/accounts/:userId/presets/:presetCode')
  @Permissions(PERMISSION_SIMULATION_MANAGE)
  @RequireStepUp()
  async applyPreset(
    @Param() user: UserIdParamDto,
    @Param() preset: SimulationPresetParamDto,
    @Body() dto: AdminReasonDto,
    @CurrentUser() actor: JwtAccessClaims,
  ): Promise<unknown> {
    return successResponse(
      await this.simulation.applyPreset(user.userId, preset.presetCode, actor.sub, dto.reason),
    );
  }

  @Post('simulation/accounts/:userId/transactions')
  @Permissions(PERMISSION_SIMULATION_MANAGE)
  @RequireStepUp()
  async createScenario(
    @Param() params: UserIdParamDto,
    @Body() dto: CreateSimulationTransactionDto,
    @CurrentUser() actor: JwtAccessClaims,
  ): Promise<unknown> {
    return successResponse(
      await this.simulation.createScenarioTransaction({
        ownerUserId: params.userId,
        assetCode: dto.assetCode,
        scenario: dto.scenario,
        amount: dto.amount,
        destinationAddress: dto.destinationAddress,
        note: dto.note,
        actorUserId: actor.sub,
        reason: dto.reason,
      }),
    );
  }

  @Get('transaction-reviews')
  @Permissions(PERMISSION_TRANSACTIONS_REVIEW_LARGE)
  async listReviews(@Query() query: AdminListReviewsQueryDto): Promise<unknown> {
    return successResponse(await this.simulation.listReviews(query));
  }

  @Get('transaction-reviews/summary')
  @Permissions(PERMISSION_TRANSACTIONS_REVIEW_LARGE)
  async reviewSummary(): Promise<unknown> {
    return successResponse(await this.simulation.reviewSummary());
  }

  @Get('transaction-reviews/:reviewId')
  @Permissions(PERMISSION_TRANSACTIONS_REVIEW_LARGE)
  async getReview(@Param() params: ReviewIdParamDto): Promise<unknown> {
    return successResponse(await this.simulation.getReview(params.reviewId));
  }

  @Post('transaction-reviews/:reviewId/approve')
  @Permissions(PERMISSION_TRANSACTIONS_REVIEW_LARGE)
  @RequireStepUp()
  async approve(
    @Param() params: ReviewIdParamDto,
    @Body() dto: ReviewDecisionDto,
    @CurrentUser() actor: JwtAccessClaims,
  ): Promise<unknown> {
    return successResponse(
      await this.simulation.approveReview(params.reviewId, actor.sub, dto.reason),
    );
  }

  @Post('transaction-reviews/:reviewId/reject')
  @Permissions(PERMISSION_TRANSACTIONS_REVIEW_LARGE)
  @RequireStepUp()
  async reject(
    @Param() params: ReviewIdParamDto,
    @Body() dto: ReviewDecisionDto,
    @CurrentUser() actor: JwtAccessClaims,
  ): Promise<unknown> {
    return successResponse(
      await this.simulation.rejectReview(params.reviewId, actor.sub, dto.reason),
    );
  }
}
