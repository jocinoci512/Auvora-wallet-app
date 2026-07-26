import { Body, Controller, Get, Inject, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { KycLevel, KycSubjectType } from '@auvora/database';
import type { JwtAccessClaims } from '@auvora/types';
import { KycService } from '../../application/services/kyc.service';
import { RiskService } from '../../application/services/risk.service';
import { DashboardService } from '../../application/services/dashboard.service';
import { PERMISSION_COMPLIANCE_READ, PERMISSION_COMPLIANCE_WRITE } from '../../domain';
import { successResponse } from '../common/api-response';
import { Permissions } from '../decorators/auth.decorators';
import { CurrentUser } from '../decorators/current-user.decorator';
import { IsEnum, IsOptional, IsString, IsUUID, MinLength } from 'class-validator';

export class SubmitKycDto {
  @IsOptional()
  @IsEnum(KycSubjectType)
  subjectType?: KycSubjectType;

  @IsEnum(KycLevel)
  requestedLevel!: KycLevel;

  @IsOptional()
  @IsString()
  country?: string;

  @IsOptional()
  @IsString()
  nationality?: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  legalName?: string;

  @IsOptional()
  @IsString()
  dateOfBirth?: string;

  @IsOptional()
  @IsString()
  businessName?: string;
}

export class UploadDocumentDto {
  @IsString()
  documentType!: string;

  @IsString()
  @MinLength(1)
  storageKey!: string;

  @IsOptional()
  @IsString()
  contentType?: string;

  @IsOptional()
  @IsString()
  fileName?: string;

  @IsOptional()
  @IsUUID()
  verificationRequestId?: string;
}

const _dtoRuntime = { SubmitKycDto, UploadDocumentDto };
void _dtoRuntime;

@ApiTags('compliance')
@ApiBearerAuth()
@Controller('api/v1/compliance')
export class ComplianceController {
  constructor(
    @Inject(KycService) private readonly kyc: KycService,
    @Inject(RiskService) private readonly riskService: RiskService,
    @Inject(DashboardService) private readonly dashboard: DashboardService,
  ) {}

  @Get('profile')
  @Permissions(PERMISSION_COMPLIANCE_READ)
  async profile(@CurrentUser() user: JwtAccessClaims) {
    const data = await this.kyc.getProfile(user.sub, user);
    return successResponse(data);
  }

  @Post('kyc')
  @Permissions(PERMISSION_COMPLIANCE_WRITE)
  async submitKyc(@CurrentUser() user: JwtAccessClaims, @Body() dto: SubmitKycDto) {
    const data = await this.kyc.submitKyc(user.sub, dto);
    return successResponse(data);
  }

  @Get('kyc/status')
  @Permissions(PERMISSION_COMPLIANCE_READ)
  async kycStatus(@CurrentUser() user: JwtAccessClaims) {
    const data = await this.kyc.getLatestVerification(user.sub);
    return successResponse(data);
  }

  @Get('documents')
  @Permissions(PERMISSION_COMPLIANCE_READ)
  async documents(@CurrentUser() user: JwtAccessClaims) {
    const data = await this.kyc.listDocuments(user.sub);
    return successResponse(data);
  }

  @Post('documents')
  @Permissions(PERMISSION_COMPLIANCE_WRITE)
  async upload(@CurrentUser() user: JwtAccessClaims, @Body() dto: UploadDocumentDto) {
    const data = await this.kyc.uploadDocument(user.sub, dto);
    return successResponse(data);
  }

  @Get('risk')
  @Permissions(PERMISSION_COMPLIANCE_READ)
  async risk(@CurrentUser() user: JwtAccessClaims) {
    const profile = await this.kyc.getProfile(user.sub, user);
    return successResponse({
      score: profile.riskScore,
      band: profile.riskBand,
      level: profile.level,
      status: profile.status,
    });
  }

  @Get('risk/history')
  @Permissions(PERMISSION_COMPLIANCE_READ)
  async riskHistory(@CurrentUser() user: JwtAccessClaims) {
    const data = await this.riskService.history(user.sub);
    return successResponse(data);
  }

  @Get('sanctions')
  @Permissions(PERMISSION_COMPLIANCE_READ)
  async sanctions(@CurrentUser() user: JwtAccessClaims) {
    const all = await this.dashboard.listSanctions(0, 50);
    return successResponse(all.filter((r) => r.ownerUserId === user.sub));
  }

  @Get('pep')
  @Permissions(PERMISSION_COMPLIANCE_READ)
  async pep(@CurrentUser() user: JwtAccessClaims) {
    const all = await this.dashboard.listPep(0, 50);
    return successResponse(all.filter((r) => r.ownerUserId === user.sub));
  }
}
