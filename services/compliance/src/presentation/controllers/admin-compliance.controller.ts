import { Body, Controller, Get, Inject, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ComplianceRuleAction, type CaseStatus, type VerificationStatus } from '@auvora/database';
import type { JwtAccessClaims } from '@auvora/types';
import { CaseService } from '../../application/services/case.service';
import { DashboardService } from '../../application/services/dashboard.service';
import { KycService } from '../../application/services/kyc.service';
import { RiskService } from '../../application/services/risk.service';
import { RulesService } from '../../application/services/rules.service';
import {
  PERMISSION_COMPLIANCE_ADMIN,
  PERMISSION_COMPLIANCE_CASES,
  PERMISSION_COMPLIANCE_REVIEW,
  PERMISSION_COMPLIANCE_RULES,
  ROLE_ADMIN,
  ROLE_SUPER_ADMIN,
} from '../../domain';
import { successResponse } from '@auvora/nest-common';
import { Permissions, Roles } from '../decorators/auth.decorators';
import { CurrentUser } from '../decorators/current-user.decorator';
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

export class RejectKycDto {
  @IsString()
  @MinLength(3)
  reason!: string;
}

export class OpenCaseDto {
  @IsOptional()
  @IsUUID()
  ownerUserId?: string;

  @IsString()
  @MinLength(3)
  title!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  priority?: string;
}

export class CaseNoteDto {
  @IsString()
  @MinLength(1)
  body!: string;
}

export class AssignCaseDto {
  @IsUUID()
  assigneeUserId!: string;
}

export class ResolveCaseDto {
  @IsString()
  @MinLength(3)
  resolution!: string;
}

export class CreateRuleDto {
  @IsString()
  @MinLength(2)
  code!: string;

  @IsString()
  @MinLength(2)
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsEnum(ComplianceRuleAction)
  action!: ComplianceRuleAction;

  @IsOptional()
  @IsInt()
  @Min(0)
  priority?: number;

  @IsObject()
  expression!: Record<string, unknown>;

  @IsOptional()
  isEnabled?: boolean;
}

export class UpdateRuleDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsEnum(ComplianceRuleAction)
  action?: ComplianceRuleAction;

  @IsOptional()
  @IsInt()
  @Min(0)
  priority?: number;

  @IsOptional()
  @IsObject()
  expression?: Record<string, unknown>;
}

export class ScoreCustomerDto {
  @IsObject()
  factors!: Record<string, number>;
}

const _adminDtoRuntime = {
  RejectKycDto,
  OpenCaseDto,
  CaseNoteDto,
  AssignCaseDto,
  ResolveCaseDto,
  CreateRuleDto,
  UpdateRuleDto,
  ScoreCustomerDto,
};
void _adminDtoRuntime;

@ApiTags('admin-compliance')
@ApiBearerAuth()
@Roles(ROLE_ADMIN, ROLE_SUPER_ADMIN)
@Controller('api/v1/admin/compliance')
export class AdminComplianceController {
  constructor(
    @Inject(DashboardService) private readonly dashboard: DashboardService,
    @Inject(KycService) private readonly kyc: KycService,
    @Inject(CaseService) private readonly cases: CaseService,
    @Inject(RulesService) private readonly rulesService: RulesService,
    @Inject(RiskService) private readonly riskService: RiskService,
  ) {}

  @Get('dashboard')
  @Permissions(PERMISSION_COMPLIANCE_ADMIN)
  async dashboardMetrics() {
    return successResponse(await this.dashboard.metrics());
  }

  @Get('kyc/queue')
  @Permissions(PERMISSION_COMPLIANCE_REVIEW)
  async kycQueue(@Query('status') status?: VerificationStatus) {
    return successResponse(await this.kyc.listQueue(status));
  }

  @Post('kyc/:id/approve')
  @Permissions(PERMISSION_COMPLIANCE_REVIEW)
  async approve(@Param('id') id: string, @CurrentUser() user: JwtAccessClaims) {
    return successResponse(await this.kyc.approve(id, user));
  }

  @Post('kyc/:id/reject')
  @Permissions(PERMISSION_COMPLIANCE_REVIEW)
  async reject(
    @Param('id') id: string,
    @Body() dto: RejectKycDto,
    @CurrentUser() user: JwtAccessClaims,
  ) {
    return successResponse(await this.kyc.reject(id, user, dto.reason));
  }

  @Get('documents')
  @Permissions(PERMISSION_COMPLIANCE_REVIEW)
  async documents() {
    return successResponse(await this.dashboard.listDocuments());
  }

  @Get('alerts')
  @Permissions(PERMISSION_COMPLIANCE_ADMIN)
  async alerts(@Query('skip') skip?: string, @Query('take') take?: string) {
    return successResponse(await this.dashboard.listAlerts(Number(skip ?? 0), Number(take ?? 50)));
  }

  @Get('risk')
  @Permissions(PERMISSION_COMPLIANCE_ADMIN)
  async risk() {
    const metrics = await this.dashboard.metrics();
    return successResponse({ recentRiskScores: metrics.recentRiskScores });
  }

  @Get('fraud')
  @Permissions(PERMISSION_COMPLIANCE_ADMIN)
  async fraud() {
    const alerts = await this.dashboard.listAlerts(0, 50);
    return successResponse({
      items: alerts.items.filter((a) => a.ruleCode.includes('fraud') || a.severity === 'CRITICAL'),
    });
  }

  @Get('sanctions')
  @Permissions(PERMISSION_COMPLIANCE_ADMIN)
  async sanctions() {
    return successResponse(await this.dashboard.listSanctions());
  }

  @Get('pep')
  @Permissions(PERMISSION_COMPLIANCE_ADMIN)
  async pep() {
    return successResponse(await this.dashboard.listPep());
  }

  @Get('cases')
  @Permissions(PERMISSION_COMPLIANCE_CASES)
  async listCases(@Query('status') status?: CaseStatus) {
    return successResponse(await this.cases.list({ status }));
  }

  @Post('cases')
  @Permissions(PERMISSION_COMPLIANCE_CASES)
  async openCase(@Body() dto: OpenCaseDto, @CurrentUser() user: JwtAccessClaims) {
    return successResponse(await this.cases.open(dto, user));
  }

  @Get('cases/:id')
  @Permissions(PERMISSION_COMPLIANCE_CASES)
  async caseDetails(@Param('id') id: string) {
    return successResponse(await this.cases.get(id));
  }

  @Post('cases/:id/assign')
  @Permissions(PERMISSION_COMPLIANCE_CASES)
  async assign(
    @Param('id') id: string,
    @Body() dto: AssignCaseDto,
    @CurrentUser() user: JwtAccessClaims,
  ) {
    return successResponse(await this.cases.assign(id, dto.assigneeUserId, user));
  }

  @Post('cases/:id/notes')
  @Permissions(PERMISSION_COMPLIANCE_CASES)
  async note(
    @Param('id') id: string,
    @Body() dto: CaseNoteDto,
    @CurrentUser() user: JwtAccessClaims,
  ) {
    return successResponse(await this.cases.addNote(id, dto.body, user));
  }

  @Post('cases/:id/resolve')
  @Permissions(PERMISSION_COMPLIANCE_CASES)
  async resolve(
    @Param('id') id: string,
    @Body() dto: ResolveCaseDto,
    @CurrentUser() user: JwtAccessClaims,
  ) {
    return successResponse(await this.cases.resolve(id, dto.resolution, user));
  }

  @Get('rules')
  @Permissions(PERMISSION_COMPLIANCE_RULES)
  async rules() {
    return successResponse(await this.rulesService.list());
  }

  @Post('rules')
  @Permissions(PERMISSION_COMPLIANCE_RULES)
  async createRule(@Body() dto: CreateRuleDto) {
    return successResponse(await this.rulesService.create(dto));
  }

  @Get('rules/:id')
  @Permissions(PERMISSION_COMPLIANCE_RULES)
  async ruleDetails(@Param('id') id: string) {
    return successResponse(await this.rulesService.get(id));
  }

  @Patch('rules/:id')
  @Permissions(PERMISSION_COMPLIANCE_RULES)
  async updateRule(@Param('id') id: string, @Body() dto: UpdateRuleDto) {
    return successResponse(await this.rulesService.update(id, dto));
  }

  @Post('rules/:id/enable')
  @Permissions(PERMISSION_COMPLIANCE_RULES)
  async enableRule(@Param('id') id: string) {
    return successResponse(await this.rulesService.setEnabled(id, true));
  }

  @Post('rules/:id/disable')
  @Permissions(PERMISSION_COMPLIANCE_RULES)
  async disableRule(@Param('id') id: string) {
    return successResponse(await this.rulesService.setEnabled(id, false));
  }

  @Post('risk/:ownerUserId/recompute')
  @Permissions(PERMISSION_COMPLIANCE_ADMIN)
  async recomputeRisk(@Param('ownerUserId') ownerUserId: string, @Body() dto: ScoreCustomerDto) {
    return successResponse(
      await this.riskService.scoreCustomer({ ownerUserId, factors: dto.factors }),
    );
  }

  @Get('providers')
  @Permissions(PERMISSION_COMPLIANCE_RULES)
  async providers() {
    return successResponse(await this.dashboard.listProviders());
  }

  @Get('reports')
  @Permissions(PERMISSION_COMPLIANCE_ADMIN)
  async reports() {
    return successResponse(await this.dashboard.reportsSummary());
  }
}
