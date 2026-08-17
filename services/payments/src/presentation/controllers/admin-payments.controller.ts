import { Body, Controller, Get, Inject, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiTags } from '@nestjs/swagger';
import type { JwtAccessClaims } from '@auvora/types';
import { AdminPaymentsService } from '../../application/services/admin-payments.service';
import { ReconciliationEngineService } from '../../application/services/reconciliation-engine.service';
import { SettlementEngineService } from '../../application/services/settlement-engine.service';
import { PaymentOrchestratorService } from '../../application/services/payment-orchestrator.service';
import { Permissions, Roles } from '../decorators/auth.decorators';
import { CurrentUser } from '../decorators/current-user.decorator';
import {
  PERMISSION_PAYMENT_ADMIN,
  PERMISSION_PAYMENT_RECONCILE,
  PERMISSION_PAYMENT_SETTLE,
  ADMIN_PORTAL_ROLES,
} from '../../domain/permission-codes';
import { successResponse } from '@auvora/nest-common';
import {
  AdminListChargebacksQueryDto,
  AdminListDisputesQueryDto,
  AdminListHealthQueryDto,
  AdminListLimitsQueryDto,
  AdminListReconciliationQueryDto,
  AdminListRefundsQueryDto,
  AdminListSettlementBatchesQueryDto,
  AdminListSettlementsQueryDto,
  CreateLimitDto,
  LimitIdParamDto,
  ReconciliationIdParamDto,
  ResolveReconciliationDto,
  RunSettlementDto,
  UpdateLimitDto,
} from '../dto/admin.dto';
import { AdminSearchPaymentsQueryDto, FlagRiskDto, PaymentIdParamDto } from '../dto/payment.dto';

// Keep DTO classes as runtime values for Nest ValidationPipe + Swagger.
const _adminPaymentsDtoRuntime = {
  AdminListChargebacksQueryDto,
  AdminListDisputesQueryDto,
  AdminListHealthQueryDto,
  AdminListLimitsQueryDto,
  AdminListReconciliationQueryDto,
  AdminListRefundsQueryDto,
  AdminListSettlementBatchesQueryDto,
  AdminListSettlementsQueryDto,
  LimitIdParamDto,
  ReconciliationIdParamDto,
  AdminSearchPaymentsQueryDto,
  PaymentIdParamDto,
};
void _adminPaymentsDtoRuntime;

@ApiTags('admin-payments')
@ApiBearerAuth()
@Roles(...ADMIN_PORTAL_ROLES)
@Permissions(PERMISSION_PAYMENT_ADMIN)
@Controller('api/v1/admin/payments')
export class AdminPaymentsController {
  constructor(
    @Inject(AdminPaymentsService) private readonly admin: AdminPaymentsService,
    @Inject(PaymentOrchestratorService) private readonly orchestrator: PaymentOrchestratorService,
    @Inject(SettlementEngineService) private readonly settlementEngine: SettlementEngineService,
    @Inject(ReconciliationEngineService)
    private readonly reconciliationEngine: ReconciliationEngineService,
  ) {}

  @Get('metrics')
  async getMetrics() {
    const data = await this.admin.getMetrics();
    return successResponse(data);
  }

  @Get()
  async search(@Query() query: AdminSearchPaymentsQueryDto) {
    const data = await this.orchestrator.adminSearch({
      type: query.type,
      status: query.status,
      currency: query.currency,
      ownerUserId: query.ownerUserId,
      skip: query.skip ?? 0,
      take: query.take ?? 50,
    });
    return successResponse(data);
  }

  @Get('providers')
  async listProviders() {
    const data = await this.admin.listProviders();
    return successResponse(data);
  }

  @Get('health')
  async listHealth(@Query() query: AdminListHealthQueryDto) {
    const data = await this.admin.listHealth({
      providerCode: query.providerCode,
      skip: query.skip ?? 0,
      take: query.take ?? 50,
    });
    return successResponse(data);
  }

  @Get('settlements')
  async listSettlements(@Query() query: AdminListSettlementsQueryDto) {
    const data = await this.admin.listSettlements({
      batchId: query.batchId,
      paymentId: query.paymentId,
      status: query.status,
      skip: query.skip ?? 0,
      take: query.take ?? 50,
    });
    return successResponse(data);
  }

  @Post('settlements')
  @Permissions(PERMISSION_PAYMENT_SETTLE)
  @ApiBody({ type: RunSettlementDto })
  async createSettlement(@Body() dto: RunSettlementDto) {
    return this.runSettlement(dto);
  }

  @Post('settlements/run')
  @Permissions(PERMISSION_PAYMENT_SETTLE)
  @ApiBody({ type: RunSettlementDto })
  async runSettlementRun(@Body() dto: RunSettlementDto) {
    return this.runSettlement(dto);
  }

  @Get('settlements/batches')
  async listSettlementBatches(@Query() query: AdminListSettlementBatchesQueryDto) {
    const data = await this.admin.listSettlementBatches({
      status: query.status,
      mode: query.mode,
      skip: query.skip ?? 0,
      take: query.take ?? 50,
    });
    return successResponse(data);
  }

  @Get('settlements/reports')
  async getSettlementReports(@Query() query: AdminListSettlementBatchesQueryDto) {
    const data = await this.admin.getSettlementReports({
      status: query.status,
      mode: query.mode,
      skip: query.skip ?? 0,
      take: query.take ?? 50,
    });
    return successResponse(data);
  }

  @Get('limits')
  async listLimits(@Query() query: AdminListLimitsQueryDto) {
    const data = await this.admin.listLimits({
      ownerUserId: query.ownerUserId,
      accountTier: query.accountTier,
      country: query.country,
      riskProfile: query.riskProfile,
      window: query.window,
      skip: query.skip ?? 0,
      take: query.take ?? 50,
    });
    return successResponse(data);
  }

  @Post('limits')
  @ApiBody({ type: CreateLimitDto })
  async createLimit(@Body() dto: CreateLimitDto) {
    const data = await this.admin.createLimit(dto);
    return successResponse(data);
  }

  @Patch('limits/:id')
  @ApiBody({ type: UpdateLimitDto })
  async updateLimit(@Param() params: LimitIdParamDto, @Body() dto: UpdateLimitDto) {
    const data = await this.admin.updateLimit(params.id, dto);
    return successResponse(data);
  }

  @Get('refunds')
  async listRefunds(@Query() query: AdminListRefundsQueryDto) {
    const data = await this.admin.listRefunds({
      paymentId: query.paymentId,
      status: query.status,
      skip: query.skip ?? 0,
      take: query.take ?? 50,
    });
    return successResponse(data);
  }

  @Get('disputes')
  async listDisputes(@Query() query: AdminListDisputesQueryDto) {
    const data = await this.admin.listDisputes({
      status: query.status,
      paymentId: query.paymentId,
      skip: query.skip ?? 0,
      take: query.take ?? 50,
    });
    return successResponse(data);
  }

  @Get('chargebacks')
  async listChargebacks(@Query() query: AdminListChargebacksQueryDto) {
    const data = await this.admin.listChargebacks({
      status: query.status,
      paymentId: query.paymentId,
      skip: query.skip ?? 0,
      take: query.take ?? 50,
    });
    return successResponse(data);
  }

  @Get('reconciliation')
  @Permissions(PERMISSION_PAYMENT_RECONCILE)
  async listReconciliation(@Query() query: AdminListReconciliationQueryDto) {
    const data = await this.admin.listReconciliation({
      status: query.status,
      requiresManualReview: query.requiresManualReview,
      skip: query.skip ?? 0,
      take: query.take ?? 50,
    });
    return successResponse(data);
  }

  @Post('reconciliation/run')
  @Permissions(PERMISSION_PAYMENT_RECONCILE)
  async runReconciliation() {
    const data = await this.reconciliationEngine.runAutoReconciliation();
    return successResponse(data);
  }

  @Post('reconciliation/:id/resolve')
  @Permissions(PERMISSION_PAYMENT_RECONCILE)
  @ApiBody({ type: ResolveReconciliationDto })
  async resolveReconciliation(
    @CurrentUser() user: JwtAccessClaims,
    @Param() params: ReconciliationIdParamDto,
    @Body() _dto: ResolveReconciliationDto,
  ) {
    const data = await this.reconciliationEngine.resolve(params.id, user.sub);
    return successResponse(data);
  }

  @Patch(':id/risk')
  @ApiBody({ type: FlagRiskDto })
  async flagRisk(@Param() params: PaymentIdParamDto, @Body() dto: FlagRiskDto) {
    const data = await this.admin.flagRisk(params.id, dto.riskFlags);
    return successResponse(data);
  }

  private async runSettlement(dto: RunSettlementDto) {
    if (dto.mode === 'instant') {
      if (!dto.paymentId) {
        throw new Error('paymentId is required for instant settlement');
      }
      const data = await this.settlementEngine.runInstant(dto.paymentId);
      return successResponse(data);
    }
    if (dto.mode === 'manual') {
      if (!dto.paymentIds || dto.paymentIds.length === 0) {
        throw new Error('paymentIds is required for manual settlement');
      }
      const data = await this.settlementEngine.runManualBatch(dto.paymentIds);
      return successResponse(data);
    }
    const data = await this.settlementEngine.runDaily();
    return successResponse(data);
  }
}
