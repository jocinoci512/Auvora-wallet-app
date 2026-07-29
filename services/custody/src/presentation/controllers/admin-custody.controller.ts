import { Body, Controller, Get, Inject, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  ApprovalPolicyKind,
  CustodyPolicyAction,
  type ApprovalRequestStatus,
  type KeyStatus,
  type RecoveryRequestStatus,
  type SigningRequestStatus,
} from '@auvora/database';
import type { JwtAccessClaims } from '@auvora/types';
import {
  IsArray,
  IsBoolean,
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
import { DashboardService } from '../../application/services/dashboard.service';
import { KeyService } from '../../application/services/key.service';
import {
  type CreateApprovalPolicyInput,
  type CreateTransactionPolicyInput,
  PolicyService,
} from '../../application/services/policy.service';
import { RecoveryService } from '../../application/services/recovery.service';
import {
  type AddSignerGroupMemberInput,
  SignerGroupService,
} from '../../application/services/signer-group.service';
import { SigningService } from '../../application/services/signing.service';
import {
  PERMISSION_CUSTODY_ADMIN,
  PERMISSION_CUSTODY_APPROVE,
  PERMISSION_CUSTODY_POLICIES,
  PERMISSION_CUSTODY_RECOVERY,
  ROLE_ADMIN,
  ROLE_SUPER_ADMIN,
  type PolicyContext,
} from '../../domain';
import { successResponse } from '@auvora/nest-common';
import { Permissions, Roles } from '../decorators/auth.decorators';
import { CurrentUser } from '../decorators/current-user.decorator';

export class RejectDto {
  @IsOptional()
  @IsString()
  reason?: string;
}

export class CreateTransactionPolicyDto implements CreateTransactionPolicyInput {
  @IsString()
  @MinLength(2)
  code!: string;

  @IsString()
  @MinLength(2)
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsEnum(CustodyPolicyAction)
  action!: CustodyPolicyAction;

  @IsOptional()
  @IsInt()
  @Min(0)
  priority?: number;

  @IsObject()
  expression!: Record<string, unknown>;

  @IsOptional()
  @IsBoolean()
  isEnabled?: boolean;
}

export class UpdateTransactionPolicyDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsEnum(CustodyPolicyAction)
  action?: CustodyPolicyAction;

  @IsOptional()
  @IsInt()
  @Min(0)
  priority?: number;

  @IsOptional()
  @IsObject()
  expression?: Record<string, unknown>;
}

export class CreateApprovalPolicyDto implements CreateApprovalPolicyInput {
  @IsString()
  @MinLength(2)
  code!: string;

  @IsString()
  @MinLength(2)
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsEnum(ApprovalPolicyKind)
  kind!: ApprovalPolicyKind;

  @IsOptional()
  @IsInt()
  @Min(1)
  threshold?: number;

  @IsOptional()
  @IsString()
  amountThreshold?: string;

  @IsOptional()
  @IsInt()
  riskThreshold?: number;

  @IsOptional()
  @IsArray()
  requiredRoles?: string[];

  @IsOptional()
  @IsUUID()
  signerGroupId?: string;

  @IsOptional()
  @IsObject()
  expression?: Record<string, unknown>;

  @IsOptional()
  @IsBoolean()
  isEnabled?: boolean;
}

export class UpdateApprovalPolicyDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsEnum(ApprovalPolicyKind)
  kind?: ApprovalPolicyKind;

  @IsOptional()
  @IsInt()
  @Min(1)
  threshold?: number;

  @IsOptional()
  @IsString()
  amountThreshold?: string;

  @IsOptional()
  @IsInt()
  riskThreshold?: number;

  @IsOptional()
  @IsArray()
  requiredRoles?: string[];

  @IsOptional()
  @IsUUID()
  signerGroupId?: string;

  @IsOptional()
  @IsObject()
  expression?: Record<string, unknown>;
}

export class CreateSignerGroupDto {
  @IsOptional()
  @IsUUID()
  ownerUserId?: string;

  @IsString()
  @MinLength(2)
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsInt()
  @Min(1)
  threshold!: number;

  @IsInt()
  @Min(1)
  totalSigners!: number;
}

export class UpdateSignerGroupDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  threshold?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  totalSigners?: number;

  @IsOptional()
  @IsBoolean()
  isEnabled?: boolean;
}

export class AddSignerGroupMemberDto implements AddSignerGroupMemberInput {
  @IsUUID()
  userId!: string;

  @IsOptional()
  @IsString()
  role?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  weight?: number;
}

export class EvaluatePolicyDto {
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
  velocity?: number;

  @IsOptional()
  @IsString()
  complianceResult?: string;
}

const _adminDtoRuntime = {
  RejectDto,
  CreateTransactionPolicyDto,
  UpdateTransactionPolicyDto,
  CreateApprovalPolicyDto,
  UpdateApprovalPolicyDto,
  CreateSignerGroupDto,
  UpdateSignerGroupDto,
  AddSignerGroupMemberDto,
  EvaluatePolicyDto,
};
void _adminDtoRuntime;

@ApiTags('admin-custody')
@ApiBearerAuth()
@Roles(ROLE_ADMIN, ROLE_SUPER_ADMIN)
@Controller('api/v1/admin/custody')
export class AdminCustodyController {
  constructor(
    @Inject(DashboardService) private readonly dashboard: DashboardService,
    @Inject(KeyService) private readonly keys: KeyService,
    @Inject(SigningService) private readonly signing: SigningService,
    @Inject(ApprovalService) private readonly approvals: ApprovalService,
    @Inject(RecoveryService) private readonly recovery: RecoveryService,
    @Inject(PolicyService) private readonly policies: PolicyService,
    @Inject(SignerGroupService) private readonly signerGroups: SignerGroupService,
  ) {}

  @Get('dashboard')
  @Permissions(PERMISSION_CUSTODY_ADMIN)
  async dashboardMetrics() {
    return successResponse(await this.dashboard.metrics());
  }

  @Get('providers')
  @Permissions(PERMISSION_CUSTODY_ADMIN)
  async providers() {
    return successResponse(await this.dashboard.listProviders());
  }

  @Get('audit')
  @Permissions(PERMISSION_CUSTODY_ADMIN)
  async audit(@Query('skip') skip?: string, @Query('take') take?: string) {
    return successResponse(await this.dashboard.auditTrail(Number(skip ?? 0), Number(take ?? 50)));
  }

  @Get('policy-violations')
  @Permissions(PERMISSION_CUSTODY_ADMIN)
  async violations(@Query('skip') skip?: string, @Query('take') take?: string) {
    return successResponse(
      await this.dashboard.policyViolations(Number(skip ?? 0), Number(take ?? 50)),
    );
  }

  @Get('keys')
  @Permissions(PERMISSION_CUSTODY_ADMIN)
  async listKeys(
    @Query('status') status?: KeyStatus,
    @Query('skip') skip?: string,
    @Query('take') take?: string,
  ) {
    return successResponse(
      await this.keys.list({ status, skip: Number(skip ?? 0), take: Number(take ?? 50) }),
    );
  }

  @Get('keys/:id')
  @Permissions(PERMISSION_CUSTODY_ADMIN)
  async getKey(@Param('id') id: string) {
    return successResponse(await this.keys.get(id));
  }

  @Get('keys/:id/audit')
  @Permissions(PERMISSION_CUSTODY_ADMIN)
  async keyAudit(@Param('id') id: string) {
    return successResponse(await this.keys.auditTrail(id));
  }

  @Post('keys/:id/revoke')
  @Permissions(PERMISSION_CUSTODY_ADMIN)
  async revokeKey(
    @Param('id') id: string,
    @Body() dto: RejectDto,
    @CurrentUser() user: JwtAccessClaims,
  ) {
    return successResponse(await this.keys.revoke(id, user, dto.reason));
  }

  @Post('keys/:id/destroy')
  @Permissions(PERMISSION_CUSTODY_ADMIN)
  async destroyKey(@Param('id') id: string, @CurrentUser() user: JwtAccessClaims) {
    return successResponse(await this.keys.destroy(id, user));
  }

  @Get('signing/queue')
  @Permissions(PERMISSION_CUSTODY_ADMIN)
  async signingQueue(@Query('status') status?: SigningRequestStatus) {
    return successResponse(await this.signing.listQueue({ status }));
  }

  @Get('signing/:id')
  @Permissions(PERMISSION_CUSTODY_ADMIN)
  async signingDetails(@Param('id') id: string) {
    return successResponse(await this.signing.get(id));
  }

  @Post('signing/:id/execute')
  @Permissions(PERMISSION_CUSTODY_ADMIN)
  async executeSigning(@Param('id') id: string) {
    return successResponse(await this.signing.execute(id));
  }

  @Get('signing/:id/verify')
  @Permissions(PERMISSION_CUSTODY_ADMIN)
  async verifySigning(@Param('id') id: string) {
    return successResponse(await this.signing.verifySignature(id));
  }

  @Get('approvals/queue')
  @Permissions(PERMISSION_CUSTODY_APPROVE)
  async approvalsQueue(@Query('status') status?: ApprovalRequestStatus) {
    return successResponse(await this.approvals.listQueue({ status }));
  }

  @Post('approvals/:id/approve')
  @Permissions(PERMISSION_CUSTODY_APPROVE)
  async approve(
    @Param('id') id: string,
    @Body('note') note: string | undefined,
    @CurrentUser() user: JwtAccessClaims,
  ) {
    return successResponse(await this.approvals.approve(id, user, note));
  }

  @Post('approvals/:id/reject')
  @Permissions(PERMISSION_CUSTODY_APPROVE)
  async rejectApproval(
    @Param('id') id: string,
    @Body() dto: RejectDto,
    @CurrentUser() user: JwtAccessClaims,
  ) {
    return successResponse(
      await this.approvals.reject(id, user, dto.reason ?? 'Rejected by approver'),
    );
  }

  @Get('recovery/queue')
  @Permissions(PERMISSION_CUSTODY_RECOVERY)
  async recoveryQueue(@Query('status') status?: RecoveryRequestStatus) {
    return successResponse(await this.recovery.listQueue({ status }));
  }

  @Post('recovery/:id/approve')
  @Permissions(PERMISSION_CUSTODY_RECOVERY)
  async approveRecovery(@Param('id') id: string, @CurrentUser() user: JwtAccessClaims) {
    return successResponse(await this.recovery.approve(id, user));
  }

  @Post('recovery/:id/complete')
  @Permissions(PERMISSION_CUSTODY_RECOVERY)
  async completeRecovery(@Param('id') id: string, @CurrentUser() user: JwtAccessClaims) {
    return successResponse(await this.recovery.complete(id, user));
  }

  @Post('recovery/:id/reject')
  @Permissions(PERMISSION_CUSTODY_RECOVERY)
  async rejectRecovery(
    @Param('id') id: string,
    @Body() dto: RejectDto,
    @CurrentUser() user: JwtAccessClaims,
  ) {
    return successResponse(await this.recovery.reject(id, user, dto.reason));
  }

  @Get('policies/transaction')
  @Permissions(PERMISSION_CUSTODY_POLICIES)
  async listTransactionPolicies() {
    return successResponse(await this.policies.listTransactionPolicies());
  }

  @Post('policies/transaction')
  @Permissions(PERMISSION_CUSTODY_POLICIES)
  async createTransactionPolicy(@Body() dto: CreateTransactionPolicyDto) {
    return successResponse(await this.policies.createTransactionPolicy(dto));
  }

  @Get('policies/transaction/:id')
  @Permissions(PERMISSION_CUSTODY_POLICIES)
  async getTransactionPolicy(@Param('id') id: string) {
    return successResponse(await this.policies.getTransactionPolicy(id));
  }

  @Patch('policies/transaction/:id')
  @Permissions(PERMISSION_CUSTODY_POLICIES)
  async updateTransactionPolicy(@Param('id') id: string, @Body() dto: UpdateTransactionPolicyDto) {
    return successResponse(await this.policies.updateTransactionPolicy(id, dto));
  }

  @Post('policies/transaction/:id/enable')
  @Permissions(PERMISSION_CUSTODY_POLICIES)
  async enableTransactionPolicy(@Param('id') id: string) {
    return successResponse(await this.policies.setTransactionPolicyEnabled(id, true));
  }

  @Post('policies/transaction/:id/disable')
  @Permissions(PERMISSION_CUSTODY_POLICIES)
  async disableTransactionPolicy(@Param('id') id: string) {
    return successResponse(await this.policies.setTransactionPolicyEnabled(id, false));
  }

  @Get('policies/approval')
  @Permissions(PERMISSION_CUSTODY_POLICIES)
  async listApprovalPolicies() {
    return successResponse(await this.policies.listApprovalPolicies());
  }

  @Post('policies/approval')
  @Permissions(PERMISSION_CUSTODY_POLICIES)
  async createApprovalPolicy(@Body() dto: CreateApprovalPolicyDto) {
    return successResponse(await this.policies.createApprovalPolicy(dto));
  }

  @Get('policies/approval/:id')
  @Permissions(PERMISSION_CUSTODY_POLICIES)
  async getApprovalPolicy(@Param('id') id: string) {
    return successResponse(await this.policies.getApprovalPolicy(id));
  }

  @Patch('policies/approval/:id')
  @Permissions(PERMISSION_CUSTODY_POLICIES)
  async updateApprovalPolicy(@Param('id') id: string, @Body() dto: UpdateApprovalPolicyDto) {
    return successResponse(await this.policies.updateApprovalPolicy(id, dto));
  }

  @Post('policies/approval/:id/enable')
  @Permissions(PERMISSION_CUSTODY_POLICIES)
  async enableApprovalPolicy(@Param('id') id: string) {
    return successResponse(await this.policies.setApprovalPolicyEnabled(id, true));
  }

  @Post('policies/approval/:id/disable')
  @Permissions(PERMISSION_CUSTODY_POLICIES)
  async disableApprovalPolicy(@Param('id') id: string) {
    return successResponse(await this.policies.setApprovalPolicyEnabled(id, false));
  }

  @Post('policy/evaluate')
  @Permissions(PERMISSION_CUSTODY_POLICIES)
  async evaluatePolicy(@Body() dto: EvaluatePolicyDto) {
    return successResponse(
      await this.policies.evaluateTransactionContext(dto as unknown as PolicyContext),
    );
  }

  @Get('signer-groups')
  @Permissions(PERMISSION_CUSTODY_ADMIN)
  async listSignerGroups() {
    return successResponse(await this.signerGroups.list());
  }

  @Post('signer-groups')
  @Permissions(PERMISSION_CUSTODY_ADMIN)
  async createSignerGroup(@Body() dto: CreateSignerGroupDto) {
    return successResponse(await this.signerGroups.create(dto));
  }

  @Get('signer-groups/:id')
  @Permissions(PERMISSION_CUSTODY_ADMIN)
  async getSignerGroup(@Param('id') id: string) {
    return successResponse(await this.signerGroups.get(id));
  }

  @Patch('signer-groups/:id')
  @Permissions(PERMISSION_CUSTODY_ADMIN)
  async updateSignerGroup(@Param('id') id: string, @Body() dto: UpdateSignerGroupDto) {
    return successResponse(await this.signerGroups.update(id, dto));
  }

  @Post('signer-groups/:id/members')
  @Permissions(PERMISSION_CUSTODY_ADMIN)
  async addSignerGroupMember(@Param('id') id: string, @Body() dto: AddSignerGroupMemberDto) {
    return successResponse(await this.signerGroups.addMember(id, dto));
  }

  @Post('signer-groups/:id/members/:userId/remove')
  @Permissions(PERMISSION_CUSTODY_ADMIN)
  async removeSignerGroupMember(@Param('id') id: string, @Param('userId') userId: string) {
    return successResponse(await this.signerGroups.removeMember(id, userId));
  }
}
