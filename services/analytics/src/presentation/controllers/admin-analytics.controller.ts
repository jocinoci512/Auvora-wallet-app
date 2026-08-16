import { Body, Controller, Get, Inject, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { AnalyticsDomain, ReportFormat } from '@auvora/database';
import type { JwtAccessClaims } from '@auvora/types';
import {
  IsBoolean,
  IsInt,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Max,
  Min,
  MinLength,
} from 'class-validator';
import { AggregationService } from '../../application/services/aggregation.service';
import { AuditService } from '../../application/services/audit.service';
import { DashboardService } from '../../application/services/dashboard.service';
import { ForecastService } from '../../application/services/forecast.service';
import { KpiService } from '../../application/services/kpi.service';
import { MetricsService } from '../../application/services/metrics.service';
import { ScheduledReportService } from '../../application/services/scheduled-report.service';
import {
  PERMISSION_ANALYTICS_ADMIN,
  PERMISSION_ANALYTICS_DASHBOARDS,
  PERMISSION_ANALYTICS_KPIS,
  ADMIN_PORTAL_ROLES,
} from '../../domain';
import { successResponse } from '@auvora/nest-common';
import { Permissions, Roles } from '../decorators/auth.decorators';
import { CurrentUser } from '../decorators/current-user.decorator';

export class PageQueryDto {
  @IsOptional()
  @IsInt()
  @Min(0)
  skip?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(200)
  take?: number;
}

export class CreateKpiDto {
  @IsString()
  @MinLength(2)
  code!: string;

  @IsString()
  @MinLength(2)
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsString()
  domain!: AnalyticsDomain;

  @IsString()
  metricCode!: string;

  @IsOptional()
  @IsNumber()
  targetValue?: number;

  @IsOptional()
  @IsNumber()
  warningThreshold?: number;

  @IsOptional()
  @IsNumber()
  criticalThreshold?: number;

  @IsOptional()
  @IsBoolean()
  higherIsBetter?: boolean;
}

export class CreateMetricDto {
  @IsString()
  @MinLength(2)
  code!: string;

  @IsString()
  @MinLength(2)
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsString()
  domain!: AnalyticsDomain;

  @IsString()
  valueType!: string;

  @IsOptional()
  @IsString()
  unit?: string;

  @IsOptional()
  @IsString()
  formula?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

export class CreateScheduledReportDto {
  @IsString()
  templateCode!: string;

  @IsString()
  @MinLength(2)
  name!: string;

  @IsString()
  cronExpression!: string;

  @IsOptional()
  @IsString()
  format?: ReportFormat;

  @IsOptional()
  @IsObject()
  parameters?: Record<string, unknown>;
}

export class RunAggregationDto {
  @IsOptional()
  @IsString()
  window?: string;

  @IsOptional()
  @IsString()
  domain?: AnalyticsDomain;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5000)
  limit?: number;
}

const _adminDtoRuntime = {
  PageQueryDto,
  CreateKpiDto,
  CreateMetricDto,
  CreateScheduledReportDto,
  RunAggregationDto,
};
void _adminDtoRuntime;

@ApiTags('admin-analytics')
@ApiBearerAuth()
@Roles(...ADMIN_PORTAL_ROLES)
@Controller('api/v1/admin/analytics')
export class AdminAnalyticsController {
  constructor(
    @Inject(DashboardService) private readonly dashboards: DashboardService,
    @Inject(AuditService) private readonly audit: AuditService,
    @Inject(MetricsService) private readonly metrics: MetricsService,
    @Inject(KpiService) private readonly kpis: KpiService,
    @Inject(AggregationService) private readonly aggregation: AggregationService,
    @Inject(ScheduledReportService) private readonly scheduledReports: ScheduledReportService,
    @Inject(ForecastService) private readonly forecasts: ForecastService,
  ) {}

  @Get('dashboard')
  @Permissions(PERMISSION_ANALYTICS_ADMIN)
  async dashboardMetrics() {
    return successResponse(await this.dashboards.adminMetrics());
  }

  @Get('audit')
  @Permissions(PERMISSION_ANALYTICS_ADMIN)
  async auditTrail(@Query() query: PageQueryDto) {
    return successResponse(await this.audit.list(query.skip, query.take));
  }

  @Get('metrics')
  @Permissions(PERMISSION_ANALYTICS_ADMIN)
  async listMetrics(@Query('domain') domain?: AnalyticsDomain) {
    return successResponse(await this.metrics.listDefinitions({ domain }));
  }

  @Post('metrics')
  @Permissions(PERMISSION_ANALYTICS_ADMIN)
  async createMetric(@Body() dto: CreateMetricDto) {
    return successResponse(
      await this.metrics.create({ ...dto, valueType: dto.valueType as never }),
    );
  }

  @Patch('metrics/:code')
  @Permissions(PERMISSION_ANALYTICS_ADMIN)
  async updateMetric(@Param('code') code: string, @Body() dto: Partial<CreateMetricDto>) {
    return successResponse(
      await this.metrics.update(code, {
        ...dto,
        valueType: dto.valueType as never,
      }),
    );
  }

  @Get('performance')
  @Permissions(PERMISSION_ANALYTICS_ADMIN)
  async performanceSummary() {
    return successResponse(await this.metrics.getPerformanceSummary());
  }

  @Get('kpis')
  @Permissions(PERMISSION_ANALYTICS_KPIS)
  async listKpis(@Query('domain') domain?: AnalyticsDomain) {
    return successResponse(await this.kpis.list({ domain }));
  }

  @Post('kpis')
  @Permissions(PERMISSION_ANALYTICS_KPIS)
  async createKpi(@Body() dto: CreateKpiDto) {
    return successResponse(await this.kpis.create(dto));
  }

  @Patch('kpis/:code')
  @Permissions(PERMISSION_ANALYTICS_KPIS)
  async updateKpi(@Param('code') code: string, @Body() dto: Partial<CreateKpiDto>) {
    return successResponse(await this.kpis.update(code, dto));
  }

  @Get('dashboards')
  @Permissions(PERMISSION_ANALYTICS_DASHBOARDS)
  async listDashboards(@Query('domain') domain?: AnalyticsDomain) {
    return successResponse(await this.dashboards.listSystem({ domain }));
  }

  @Get('dashboards/:code')
  @Permissions(PERMISSION_ANALYTICS_DASHBOARDS)
  async getDashboard(@Param('code') code: string) {
    return successResponse(await this.dashboards.getByCode(code));
  }

  @Post('aggregate/run')
  @Permissions(PERMISSION_ANALYTICS_ADMIN)
  async runAggregation(@Body() dto: RunAggregationDto) {
    return successResponse(
      await this.aggregation.run({
        window: dto.window as never,
        domain: dto.domain,
        limit: dto.limit,
      }),
    );
  }

  @Get('scheduled-reports')
  @Permissions(PERMISSION_ANALYTICS_ADMIN)
  async listScheduledReports(@Query('ownerUserId') ownerUserId?: string) {
    return successResponse(await this.scheduledReports.list(ownerUserId));
  }

  @Post('scheduled-reports')
  @Permissions(PERMISSION_ANALYTICS_ADMIN)
  async createScheduledReport(
    @CurrentUser() user: JwtAccessClaims,
    @Body() dto: CreateScheduledReportDto,
  ) {
    return successResponse(
      await this.scheduledReports.create({
        ...dto,
        ownerUserId: user.sub,
      }),
    );
  }

  @Post('scheduled-reports/:id/pause')
  @Permissions(PERMISSION_ANALYTICS_ADMIN)
  async pauseScheduledReport(@Param('id') id: string) {
    return successResponse(await this.scheduledReports.pause(id));
  }

  @Post('scheduled-reports/:id/resume')
  @Permissions(PERMISSION_ANALYTICS_ADMIN)
  async resumeScheduledReport(@Param('id') id: string) {
    return successResponse(await this.scheduledReports.resume(id));
  }

  @Get('forecasts')
  @Permissions(PERMISSION_ANALYTICS_ADMIN)
  async listForecasts() {
    return successResponse(await this.forecasts.listModels());
  }

  @Post('forecasts/:code/run')
  @Permissions(PERMISSION_ANALYTICS_ADMIN)
  async runForecast(@Param('code') code: string) {
    return successResponse(await this.forecasts.run(code));
  }
}
