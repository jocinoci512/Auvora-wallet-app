import { Body, Controller, Get, Inject, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { AnalyticsDomain, ReportFormat } from '@auvora/database';
import type { JwtAccessClaims } from '@auvora/types';
import { IsInt, IsObject, IsOptional, IsString, Max, Min, MinLength } from 'class-validator';
import { DashboardService } from '../../application/services/dashboard.service';
import { ForecastService } from '../../application/services/forecast.service';
import { InsightsService } from '../../application/services/insights.service';
import { KpiService } from '../../application/services/kpi.service';
import { MetricsService } from '../../application/services/metrics.service';
import { ReportService } from '../../application/services/report.service';
import {
  PERMISSION_ANALYTICS_DASHBOARDS,
  PERMISSION_ANALYTICS_KPIS,
  PERMISSION_ANALYTICS_READ,
  PERMISSION_ANALYTICS_REPORTS,
  PERMISSION_ANALYTICS_WRITE,
} from '../../domain';
import { successResponse } from '@auvora/nest-common';
import { Permissions } from '../decorators/auth.decorators';
import { CorrelationId, CurrentUser } from '../decorators/current-user.decorator';

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

export class GenerateReportDto {
  @IsOptional()
  @IsString()
  templateCode?: string;

  @IsString()
  @MinLength(2)
  name!: string;

  @IsOptional()
  @IsString()
  format?: ReportFormat;

  @IsOptional()
  @IsObject()
  parameters?: Record<string, unknown>;
}

export class CreateDashboardDto {
  @IsString()
  @MinLength(2)
  code!: string;

  @IsString()
  @MinLength(2)
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  domain?: AnalyticsDomain;

  @IsOptional()
  @IsObject()
  layout?: Record<string, unknown>;
}

const _dtoRuntime = { PageQueryDto, GenerateReportDto, CreateDashboardDto };
void _dtoRuntime;

@ApiTags('analytics')
@ApiBearerAuth()
@Controller('api/v1/analytics')
export class AnalyticsController {
  constructor(
    @Inject(MetricsService) private readonly metrics: MetricsService,
    @Inject(KpiService) private readonly kpis: KpiService,
    @Inject(DashboardService) private readonly dashboards: DashboardService,
    @Inject(ReportService) private readonly reports: ReportService,
    @Inject(ForecastService) private readonly forecasts: ForecastService,
    @Inject(InsightsService) private readonly insights: InsightsService,
  ) {}

  @Get('metrics')
  @Permissions(PERMISSION_ANALYTICS_READ)
  async listMetrics(@Query('domain') domain: AnalyticsDomain | undefined) {
    return successResponse(await this.metrics.listDefinitions({ domain, enabledOnly: true }));
  }

  @Get('metrics/:code/values')
  @Permissions(PERMISSION_ANALYTICS_READ)
  async metricValues(@Param('code') code: string, @Query('window') window?: string) {
    return successResponse(
      await this.metrics.getValues(code, {
        window: window as never,
      }),
    );
  }

  @Get('kpis')
  @Permissions(PERMISSION_ANALYTICS_READ)
  async listKpis(@Query('domain') domain: AnalyticsDomain | undefined) {
    return successResponse(await this.kpis.list({ domain, enabledOnly: true }));
  }

  @Get('kpis/:code/evaluate')
  @Permissions(PERMISSION_ANALYTICS_KPIS, PERMISSION_ANALYTICS_READ)
  async evaluateKpi(@Param('code') code: string) {
    return successResponse(await this.kpis.evaluate(code));
  }

  @Get('dashboards')
  @Permissions(PERMISSION_ANALYTICS_READ)
  async listDashboards(
    @CurrentUser() user: JwtAccessClaims,
    @Query('domain') domain?: AnalyticsDomain,
  ) {
    return successResponse(await this.dashboards.listForUser(user.sub, { domain }));
  }

  @Get('dashboards/:code')
  @Permissions(PERMISSION_ANALYTICS_READ)
  async getDashboard(@Param('code') code: string, @CurrentUser() user: JwtAccessClaims) {
    const dashboard = await this.dashboards.getByCode(code);
    this.dashboards.assertReadable(dashboard, user.sub, user.roles.includes('admin'));
    return successResponse(dashboard);
  }

  @Post('dashboards')
  @Permissions(PERMISSION_ANALYTICS_DASHBOARDS, PERMISSION_ANALYTICS_WRITE)
  async createDashboard(@CurrentUser() user: JwtAccessClaims, @Body() dto: CreateDashboardDto) {
    return successResponse(
      await this.dashboards.create({
        ...dto,
        ownerUserId: user.sub,
      }),
    );
  }

  @Get('reports')
  @Permissions(PERMISSION_ANALYTICS_REPORTS, PERMISSION_ANALYTICS_READ)
  async listReports(@CurrentUser() user: JwtAccessClaims, @Query() query: PageQueryDto) {
    return successResponse(await this.reports.listForUser(user.sub, query.skip, query.take));
  }

  @Post('reports')
  @Permissions(PERMISSION_ANALYTICS_REPORTS)
  async generateReport(
    @CurrentUser() user: JwtAccessClaims,
    @Body() dto: GenerateReportDto,
    @CorrelationId() correlationId?: string,
  ) {
    return successResponse(
      await this.reports.generate({
        ...dto,
        ownerUserId: user.sub,
        correlationId,
      }),
    );
  }

  @Get('reports/:id')
  @Permissions(PERMISSION_ANALYTICS_REPORTS, PERMISSION_ANALYTICS_READ)
  async getReport(@Param('id') id: string, @CurrentUser() user: JwtAccessClaims) {
    const isAdmin = user.roles.includes('admin') || user.roles.includes('super_admin');
    const report = await this.reports.get(id, user.sub, isAdmin);
    const result = await this.reports.getDecryptedResult(id, user.sub, isAdmin);
    return successResponse({ report, result });
  }

  @Get('forecasts/:code')
  @Permissions(PERMISSION_ANALYTICS_READ)
  async getForecast(@Param('code') code: string) {
    return successResponse(await this.forecasts.latestResult(code));
  }

  @Post('forecasts/:code/run')
  @Permissions(PERMISSION_ANALYTICS_READ)
  async runForecast(@Param('code') code: string, @Query('horizon') horizon?: string) {
    const parsedHorizon = horizon ? Number.parseInt(horizon, 10) : 7;
    return successResponse(
      await this.forecasts.run(code, Number.isFinite(parsedHorizon) ? parsedHorizon : 7),
    );
  }

  @Get('insights')
  @Permissions(PERMISSION_ANALYTICS_READ)
  async insightsSummary() {
    return successResponse(await this.insights.summary());
  }
}
