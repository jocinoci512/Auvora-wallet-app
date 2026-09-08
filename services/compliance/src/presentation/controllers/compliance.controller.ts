import {
  Body,
  Controller,
  Get,
  Headers,
  Inject,
  Param,
  Post,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { KycLevel, KycSubjectType } from '@auvora/database';
import type { JwtAccessClaims } from '@auvora/types';
import { KycService } from '../../application/services/kyc.service';
import { RiskService } from '../../application/services/risk.service';
import { DashboardService } from '../../application/services/dashboard.service';
import {
  PERMISSION_COMPLIANCE_READ,
  PERMISSION_COMPLIANCE_WRITE,
  UnauthorizedError,
} from '../../domain';
import { successResponse } from '@auvora/nest-common';
import { Permissions, Public, SkipCsrf } from '../decorators/auth.decorators';
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

  @IsOptional()
  @IsString()
  idType?: string;

  @IsOptional()
  @IsString()
  idNumber?: string;

  @IsOptional()
  @IsString()
  idExpiration?: string;

  @IsOptional()
  @IsUUID()
  frontDocumentId?: string;

  @IsOptional()
  @IsUUID()
  backDocumentId?: string;
}

export class UploadDocumentDto {
  @IsString()
  documentType!: string;

  @IsOptional()
  @IsString()
  storageKey?: string;

  @IsOptional()
  @IsString()
  contentType?: string;

  @IsOptional()
  @IsString()
  fileName?: string;

  @IsOptional()
  @IsString()
  fileBase64?: string;

  @IsOptional()
  @IsString()
  side?: 'front' | 'back';

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

  @Get('kyc')
  @Permissions(PERMISSION_COMPLIANCE_READ)
  async kycSnapshot(@CurrentUser() user: JwtAccessClaims) {
    const data = await this.kyc.getCustomerSnapshot(user.sub, user);
    return successResponse(data);
  }

  @Post('kyc')
  @Permissions(PERMISSION_COMPLIANCE_WRITE)
  async submitKyc(@CurrentUser() user: JwtAccessClaims, @Body() dto: SubmitKycDto) {
    const data = await this.kyc.submitKyc(user.sub, dto);
    return successResponse(this.kyc.toCustomerVerification(data));
  }

  @Get('kyc/status')
  @Permissions(PERMISSION_COMPLIANCE_READ)
  async kycStatus(@CurrentUser() user: JwtAccessClaims) {
    const data = await this.kyc.getLatestVerification(user.sub);
    return successResponse(this.kyc.toCustomerVerification(data));
  }

  @Post('webhook')
  @Public()
  @SkipCsrf()
  async webhook(
    @Req() req: Request,
    @Headers('stripe-signature') stripeSignature?: string,
    @Headers('x-kyc-signature') genericSignature?: string,
  ) {
    const rawBody =
      (req as unknown as { rawBody?: Buffer | string }).rawBody?.toString() ??
      (typeof req.body === 'string' ? req.body : JSON.stringify(req.body));
    const signature = stripeSignature || genericSignature;
    const result = await this.kyc.handleWebhook(rawBody, signature);
    return successResponse(result);
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
    if (dto.fileBase64) {
      const buffer = Buffer.from(dto.fileBase64, 'base64');
      const data = await this.kyc.uploadDocumentPayload(user.sub, {
        documentType: dto.documentType,
        fileBuffer: buffer,
        fileName: dto.fileName,
        requestedContentType: dto.contentType,
        side: dto.side,
        verificationRequestId: dto.verificationRequestId,
      });
      return successResponse(data);
    }
    const data = await this.kyc.uploadDocument(user.sub, {
      ...dto,
      storageKey: dto.storageKey || `local://${dto.fileName || 'doc'}`,
    });
    return successResponse(data);
  }

  @Get('documents/:id/token-content')
  @Public()
  async documentContentWithToken(
    @Param('id') id: string,
    @Query('token') token: string,
    @Res() res: Response,
  ) {
    if (!token) {
      throw new UnauthorizedError('Token is required');
    }
    const { buffer, contentType, fileName } = await this.kyc.getDocumentContentWithToken(id, token);
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `inline; filename="${fileName}"`);
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.end(buffer);
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
