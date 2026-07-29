import { Body, Controller, Inject, Post, UseGuards } from '@nestjs/common';
import { ApiExcludeController, ApiTags } from '@nestjs/swagger';
import { IsObject, IsOptional, IsString, IsUUID, Matches } from 'class-validator';
import { PolicyGateService } from '../../application/services/policy-gate.service';
import { successResponse } from '@auvora/nest-common';
import { Public, SkipCsrf } from '../decorators/auth.decorators';
import { InternalApiKeyGuard } from '../guards/internal-api-key.guard';

export class PolicyEvaluateDto {
  @IsUUID()
  ownerUserId!: string;

  @IsString()
  @Matches(/^\d+(\.\d+)?$/)
  amount!: string;

  @IsString()
  currency!: string;

  @IsOptional()
  @IsString()
  paymentType?: string;

  @IsOptional()
  @IsUUID()
  paymentId?: string;

  @IsOptional()
  @IsUUID()
  walletId?: string;

  @IsOptional()
  @IsString()
  country?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

const _internalDtoRuntime = { PolicyEvaluateDto };
void _internalDtoRuntime;

@ApiTags('internal-compliance')
@ApiExcludeController()
@Public()
@SkipCsrf()
@UseGuards(InternalApiKeyGuard)
@Controller('api/v1/internal/compliance')
export class InternalComplianceController {
  constructor(@Inject(PolicyGateService) private readonly policy: PolicyGateService) {}

  @Post('policy/evaluate')
  async evaluate(@Body() dto: PolicyEvaluateDto) {
    const data = await this.policy.evaluatePayment(dto);
    return successResponse(data);
  }

  @Post('fraud/check')
  async fraudCheck(@Body() dto: PolicyEvaluateDto) {
    const data = await this.policy.evaluatePayment(dto);
    return successResponse({
      allow: data.allow,
      riskScore: data.riskScore,
      reasons: data.reasons,
    });
  }
}
