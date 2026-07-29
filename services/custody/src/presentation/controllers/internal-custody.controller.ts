import { Body, Controller, Inject, Post, UseGuards } from '@nestjs/common';
import { ApiExcludeController, ApiTags } from '@nestjs/swagger';
import { KeyAlgorithm, CustodyModel, SigningRequestType } from '@auvora/database';
import { IsEnum, IsObject, IsOptional, IsString, IsUUID, MinLength } from 'class-validator';
import { KeyService } from '../../application/services/key.service';
import { PolicyService } from '../../application/services/policy.service';
import { SigningService } from '../../application/services/signing.service';
import type { PolicyContext } from '../../domain';
import { successResponse } from '@auvora/nest-common';
import { Public, SkipCsrf } from '../decorators/auth.decorators';
import { InternalApiKeyGuard } from '../guards/internal-api-key.guard';

export class InternalGenerateKeyDto {
  @IsUUID()
  ownerUserId!: string;

  @IsEnum(KeyAlgorithm)
  algorithm!: KeyAlgorithm;

  @IsEnum(CustodyModel)
  custodyModel!: CustodyModel;

  @IsOptional()
  @IsUUID()
  walletId?: string;

  @IsOptional()
  @IsString()
  label?: string;
}

export class InternalSignDto {
  @IsUUID()
  keyId!: string;

  @IsOptional()
  @IsEnum(SigningRequestType)
  requestType?: SigningRequestType;

  @IsString()
  @MinLength(1)
  payload!: string;

  @IsOptional()
  @IsString()
  amount?: string;

  @IsOptional()
  @IsString()
  asset?: string;

  @IsOptional()
  @IsString()
  destination?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

export class InternalVerifyDto {
  @IsEnum(CustodyModel)
  custodyModel!: CustodyModel;

  @IsEnum(KeyAlgorithm)
  algorithm!: KeyAlgorithm;

  @IsString()
  publicKey!: string;

  @IsString()
  payloadHash!: string;

  @IsString()
  signature!: string;
}

export class InternalPolicyEvaluateDto {
  @IsOptional()
  @IsString()
  asset?: string;

  @IsOptional()
  amount?: number;

  @IsOptional()
  @IsString()
  destination?: string;

  @IsOptional()
  @IsString()
  country?: string;

  @IsOptional()
  riskScore?: number;

  @IsOptional()
  @IsString()
  walletType?: string;

  @IsOptional()
  @IsString()
  userRole?: string;

  @IsOptional()
  time?: number;

  @IsOptional()
  velocity?: number;

  @IsOptional()
  @IsString()
  complianceResult?: string;
}

const _internalDtoRuntime = {
  InternalGenerateKeyDto,
  InternalSignDto,
  InternalVerifyDto,
  InternalPolicyEvaluateDto,
};
void _internalDtoRuntime;

@ApiTags('internal-custody')
@ApiExcludeController()
@Public()
@SkipCsrf()
@UseGuards(InternalApiKeyGuard)
@Controller('api/v1/internal/custody')
export class InternalCustodyController {
  constructor(
    @Inject(KeyService) private readonly keys: KeyService,
    @Inject(SigningService) private readonly signing: SigningService,
    @Inject(PolicyService) private readonly policies: PolicyService,
  ) {}

  @Post('keys/generate')
  async generateKey(@Body() dto: InternalGenerateKeyDto) {
    const { ownerUserId, ...rest } = dto;
    return successResponse(await this.keys.generate(ownerUserId, rest));
  }

  @Post('sign')
  async sign(@Body() dto: InternalSignDto) {
    const created = await this.signing.createSystemRequest(dto);
    if (created.status === 'QUEUED') {
      return successResponse(await this.signing.execute(created.id));
    }
    return successResponse(created);
  }

  @Post('verify')
  async verify(@Body() dto: InternalVerifyDto) {
    return successResponse(await this.signing.verifyRaw(dto));
  }

  @Post('policy/evaluate')
  async evaluate(@Body() dto: InternalPolicyEvaluateDto) {
    return successResponse(
      await this.policies.evaluateTransactionContext(dto as unknown as PolicyContext),
    );
  }
}
