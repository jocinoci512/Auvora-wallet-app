import { Body, Controller, Get, Inject, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiTags } from '@nestjs/swagger';
import type { JwtAccessClaims } from '@auvora/types';
import { LimitsService } from '../../application/services/limits.service';
import { PaymentMethodsService } from '../../application/services/payment-methods.service';
import { PaymentOrchestratorService } from '../../application/services/payment-orchestrator.service';
import { PERMISSION_PAYMENT_READ, PERMISSION_PAYMENT_WRITE } from '../../domain/permission-codes';
import { successResponse } from '@auvora/nest-common';
import { Permissions } from '../decorators/auth.decorators';
import { CurrentUser } from '../decorators/current-user.decorator';
import { CreatePaymentMethodDto, ListPaymentMethodsQueryDto } from '../dto/payment-method.dto';
import {
  CreatePaymentDto,
  CreatePaymentRequestDto,
  CreateTransferDto,
  PaymentIdParamDto,
  RefundPaymentDto,
  SearchPaymentsQueryDto,
} from '../dto/payment.dto';

// Keep DTO classes as runtime values for Nest ValidationPipe + Swagger.
const _paymentsDtoRuntime = {
  ListPaymentMethodsQueryDto,
  PaymentIdParamDto,
  SearchPaymentsQueryDto,
};
void _paymentsDtoRuntime;

@ApiTags('payments')
@ApiBearerAuth()
@Controller('api/v1/payments')
export class PaymentsController {
  constructor(
    @Inject(PaymentOrchestratorService) private readonly orchestrator: PaymentOrchestratorService,
    @Inject(PaymentMethodsService) private readonly paymentMethods: PaymentMethodsService,
    @Inject(LimitsService) private readonly limitsService: LimitsService,
  ) {}

  @Post()
  @Permissions(PERMISSION_PAYMENT_WRITE)
  @ApiBody({ type: CreatePaymentDto })
  async create(@CurrentUser() user: JwtAccessClaims, @Body() dto: CreatePaymentDto) {
    const data = await this.orchestrator.createPayment({ ownerUserId: user.sub, ...dto });
    return successResponse(data);
  }

  @Get()
  @Permissions(PERMISSION_PAYMENT_READ)
  async search(@CurrentUser() user: JwtAccessClaims, @Query() query: SearchPaymentsQueryDto) {
    const data = await this.orchestrator.search(
      {
        type: query.type,
        status: query.status,
        currency: query.currency,
        skip: query.skip ?? 0,
        take: query.take ?? 50,
      },
      user,
    );
    return successResponse(data);
  }

  @Post('transfers')
  @Permissions(PERMISSION_PAYMENT_WRITE)
  @ApiBody({ type: CreateTransferDto })
  async createTransfer(@CurrentUser() user: JwtAccessClaims, @Body() dto: CreateTransferDto) {
    const data = await this.orchestrator.createTransfer({ ownerUserId: user.sub, ...dto });
    return successResponse(data);
  }

  @Post('requests')
  @Permissions(PERMISSION_PAYMENT_WRITE)
  @ApiBody({ type: CreatePaymentRequestDto })
  async createRequest(@CurrentUser() user: JwtAccessClaims, @Body() dto: CreatePaymentRequestDto) {
    const data = await this.orchestrator.createPaymentRequest({ ownerUserId: user.sub, ...dto });
    return successResponse(data);
  }

  @Get('methods')
  @Permissions(PERMISSION_PAYMENT_READ)
  async listMethods(
    @CurrentUser() user: JwtAccessClaims,
    @Query() query: ListPaymentMethodsQueryDto,
  ) {
    const data = await this.paymentMethods.listForUser(user.sub, {
      isActive: query.isActive,
      skip: query.skip ?? 0,
      take: query.take ?? 50,
    });
    return successResponse(data);
  }

  @Post('methods')
  @Permissions(PERMISSION_PAYMENT_WRITE)
  @ApiBody({ type: CreatePaymentMethodDto })
  async createMethod(@CurrentUser() user: JwtAccessClaims, @Body() dto: CreatePaymentMethodDto) {
    const data = await this.paymentMethods.create(user.sub, dto);
    return successResponse(data);
  }

  @Get('limits')
  @Permissions(PERMISSION_PAYMENT_READ)
  async getLimits(@CurrentUser() user: JwtAccessClaims) {
    const data = await this.limitsService.listForUser(user.sub);
    return successResponse(data);
  }

  @Get('statistics')
  @Permissions(PERMISSION_PAYMENT_READ)
  async getStatistics(@CurrentUser() user: JwtAccessClaims) {
    const data = await this.orchestrator.getStatistics(user.sub);
    return successResponse(data);
  }

  @Get(':id')
  @Permissions(PERMISSION_PAYMENT_READ)
  async get(@CurrentUser() user: JwtAccessClaims, @Param() params: PaymentIdParamDto) {
    const data = await this.orchestrator.get(params.id, user);
    return successResponse(data);
  }

  @Get(':id/receipt')
  @Permissions(PERMISSION_PAYMENT_READ)
  async getReceipt(@CurrentUser() user: JwtAccessClaims, @Param() params: PaymentIdParamDto) {
    const data = await this.orchestrator.getReceipt(params.id, user);
    return successResponse(data);
  }

  @Post(':id/cancel')
  @Permissions(PERMISSION_PAYMENT_WRITE)
  async cancel(@CurrentUser() user: JwtAccessClaims, @Param() params: PaymentIdParamDto) {
    const data = await this.orchestrator.cancel(params.id, user);
    return successResponse(data);
  }

  @Post(':id/refund')
  @Permissions(PERMISSION_PAYMENT_WRITE)
  @ApiBody({ type: RefundPaymentDto })
  async refund(
    @CurrentUser() user: JwtAccessClaims,
    @Param() params: PaymentIdParamDto,
    @Body() dto: RefundPaymentDto,
  ) {
    const data = await this.orchestrator.refund(params.id, dto, user);
    return successResponse(data);
  }
}
