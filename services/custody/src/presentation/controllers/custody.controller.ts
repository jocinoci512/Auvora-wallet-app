import { Body, Controller, Delete, Get, Inject, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { KeyAlgorithm, CustodyModel, SigningRequestType } from '@auvora/database';
import type { JwtAccessClaims } from '@auvora/types';
import {
  IsEnum,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  MinLength,
} from 'class-validator';
import { ApprovalService } from '../../application/services/approval.service';
import { KeyService } from '../../application/services/key.service';
import { RecoveryService } from '../../application/services/recovery.service';
import { SigningService } from '../../application/services/signing.service';
import {
  PERMISSION_CUSTODY_APPROVE,
  PERMISSION_CUSTODY_READ,
  PERMISSION_CUSTODY_RECOVERY,
  PERMISSION_CUSTODY_WRITE,
} from '../../domain';
import { successResponse } from '../common/api-response';
import { Permissions } from '../decorators/auth.decorators';
import { CurrentUser } from '../decorators/current-user.decorator';

export class GenerateKeyDto {
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

export class CreateSigningRequestDto {
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

export class ApprovalDecisionDto {
  @IsOptional()
  @IsString()
  note?: string;
}

export class AddRecoveryContactDto {
  @IsUUID()
  policyId!: string;

  @IsString()
  @MinLength(1)
  label!: string;

  @IsOptional()
  @IsString()
  email?: string;

  @IsOptional()
  @IsString()
  phone?: string;
}

export class StartRecoveryDto {
  @IsOptional()
  @IsUUID()
  policyId?: string;

  @IsOptional()
  @IsUUID()
  keyId?: string;

  @IsOptional()
  @IsString()
  reason?: string;
}

export class PageQueryDto {
  @IsOptional()
  @IsInt()
  @Min(0)
  skip?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  take?: number;
}

const _dtoRuntime = {
  GenerateKeyDto,
  CreateSigningRequestDto,
  ApprovalDecisionDto,
  AddRecoveryContactDto,
  StartRecoveryDto,
  PageQueryDto,
};
void _dtoRuntime;

@ApiTags('custody')
@ApiBearerAuth()
@Controller('api/v1/custody')
export class CustodyController {
  constructor(
    @Inject(KeyService) private readonly keys: KeyService,
    @Inject(SigningService) private readonly signing: SigningService,
    @Inject(ApprovalService) private readonly approvals: ApprovalService,
    @Inject(RecoveryService) private readonly recovery: RecoveryService,
  ) {}

  @Get('keys')
  @Permissions(PERMISSION_CUSTODY_READ)
  async listKeys(@CurrentUser() user: JwtAccessClaims, @Query() query: PageQueryDto) {
    return successResponse(await this.keys.list({ ownerUserId: user.sub, skip: query.skip, take: query.take }));
  }

  @Post('keys')
  @Permissions(PERMISSION_CUSTODY_WRITE)
  async generateKey(@CurrentUser() user: JwtAccessClaims, @Body() dto: GenerateKeyDto) {
    return successResponse(await this.keys.generate(user.sub, dto));
  }

  @Get('keys/:id')
  @Permissions(PERMISSION_CUSTODY_READ)
  async getKey(@Param('id') id: string, @CurrentUser() user: JwtAccessClaims) {
    return successResponse(await this.keys.get(id, user));
  }

  @Post('keys/:id/rotate')
  @Permissions(PERMISSION_CUSTODY_WRITE)
  async rotateKey(@Param('id') id: string, @CurrentUser() user: JwtAccessClaims) {
    return successResponse(await this.keys.rotate(id, user));
  }

  @Get('keys/:id/audit')
  @Permissions(PERMISSION_CUSTODY_READ)
  async keyAudit(@Param('id') id: string, @CurrentUser() user: JwtAccessClaims) {
    await this.keys.get(id, user);
    return successResponse(await this.keys.auditTrail(id));
  }

  @Post('signing-requests')
  @Permissions(PERMISSION_CUSTODY_WRITE)
  async createSigningRequest(@CurrentUser() user: JwtAccessClaims, @Body() dto: CreateSigningRequestDto) {
    return successResponse(await this.signing.createRequest(user, dto));
  }

  @Get('signing-requests')
  @Permissions(PERMISSION_CUSTODY_READ)
  async listSigningRequests(@CurrentUser() user: JwtAccessClaims, @Query() query: PageQueryDto) {
    return successResponse(await this.signing.history(user.sub, query));
  }

  @Get('signing-requests/:id')
  @Permissions(PERMISSION_CUSTODY_READ)
  async getSigningRequest(@Param('id') id: string) {
    return successResponse(await this.signing.get(id));
  }

  @Post('signing-requests/:id/approve')
  @Permissions(PERMISSION_CUSTODY_APPROVE)
  async approveOwn(
    @Param('id') id: string,
    @Body() dto: ApprovalDecisionDto,
    @CurrentUser() user: JwtAccessClaims,
  ) {
    return successResponse(await this.approvals.approve(id, user, dto.note));
  }

  @Post('signing-requests/:id/reject')
  @Permissions(PERMISSION_CUSTODY_APPROVE)
  async rejectOwn(
    @Param('id') id: string,
    @Body() dto: ApprovalDecisionDto,
    @CurrentUser() user: JwtAccessClaims,
  ) {
    return successResponse(await this.approvals.reject(id, user, dto.note ?? 'rejected'));
  }

  @Get('status')
  @Permissions(PERMISSION_CUSTODY_READ)
  async status(@CurrentUser() user: JwtAccessClaims) {
    const [keys, signing, recoveries] = await Promise.all([
      this.keys.list({ ownerUserId: user.sub, take: 1 }),
      this.signing.history(user.sub, { take: 100 }),
      this.recovery.listOwn(user.sub),
    ]);
    return successResponse({
      keyCount: keys.total,
      pendingApprovals: signing.items.filter(
        (r) => r.status === 'AWAITING_APPROVAL' || r.status === 'PENDING',
      ).length,
      openRecoveries: recoveries.filter((r) =>
        ['PENDING', 'AWAITING_APPROVAL', 'APPROVED'].includes(r.status),
      ).length,
      activeProviders: 0,
    });
  }

  @Get('recovery/contacts')
  @Permissions(PERMISSION_CUSTODY_RECOVERY)
  async listRecoveryContacts(@CurrentUser() user: JwtAccessClaims) {
    return successResponse(await this.recovery.listContacts(user.sub));
  }

  @Post('recovery/contacts')
  @Permissions(PERMISSION_CUSTODY_RECOVERY)
  async addRecoveryContact(@CurrentUser() user: JwtAccessClaims, @Body() dto: AddRecoveryContactDto) {
    return successResponse(await this.recovery.addContact(user.sub, dto));
  }

  @Delete('recovery/contacts/:id')
  @Permissions(PERMISSION_CUSTODY_RECOVERY)
  async removeRecoveryContact(@Param('id') id: string, @CurrentUser() user: JwtAccessClaims) {
    return successResponse(await this.recovery.removeContact(id, user.sub));
  }

  @Post('recovery/start')
  @Permissions(PERMISSION_CUSTODY_RECOVERY)
  async startRecovery(@CurrentUser() user: JwtAccessClaims, @Body() dto: StartRecoveryDto) {
    return successResponse(await this.recovery.startRecovery(user.sub, dto));
  }

  @Get('recovery')
  @Permissions(PERMISSION_CUSTODY_RECOVERY)
  async listOwnRecovery(@CurrentUser() user: JwtAccessClaims) {
    return successResponse(await this.recovery.listOwn(user.sub));
  }

  @Get('security/activity')
  @Permissions(PERMISSION_CUSTODY_READ)
  async securityActivity(@CurrentUser() user: JwtAccessClaims) {
    return successResponse(await this.keys.securityActivity(user.sub));
  }
}
