import { Body, Controller, Get, Inject, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type {
  ObsAlertSeverity,
  ObsIncidentSeverity,
  ObsServiceDomain,
  ObsSloIndicatorType,
} from '@auvora/database';
import type { JwtAccessClaims } from '@auvora/types';
import { IsBoolean, IsNumber, IsObject, IsOptional, IsString, MinLength } from 'class-validator';
import { AlertingService } from '../../application/services/alerting.service';
import { AuditService } from '../../application/services/audit.service';
import { CapacityService } from '../../application/services/capacity.service';
import { DependencyService } from '../../application/services/dependency.service';
import { HealthMonitorService } from '../../application/services/health-monitor.service';
import { IncidentService } from '../../application/services/incident.service';
import { LoggingService } from '../../application/services/logging.service';
import { MaintenanceService } from '../../application/services/maintenance.service';
import { MetricsService } from '../../application/services/metrics.service';
import { OpsDashboardService } from '../../application/services/ops-dashboard.service';
import { SloService } from '../../application/services/slo.service';
import { TracingService } from '../../application/services/tracing.service';
import {
  PERMISSION_OBSERVABILITY_ADMIN,
  PERMISSION_OBSERVABILITY_ALERTS,
  PERMISSION_OBSERVABILITY_INCIDENTS,
  PERMISSION_OBSERVABILITY_SLO,
  ADMIN_PORTAL_ROLES,
} from '../../domain';
import { successResponse } from '@auvora/nest-common';
import { Permissions, Roles } from '../decorators/auth.decorators';
import { CurrentUser } from '../decorators/current-user.decorator';

class CreateAlertRuleDto {
  @IsString() @MinLength(2) code!: string;
  @IsString() @MinLength(2) name!: string;
  @IsOptional() @IsString() description?: string;
  @IsString() domain!: ObsServiceDomain;
  @IsOptional() @IsString() metricCode?: string;
  @IsOptional() @IsString() ruleType?: string;
  @IsOptional() @IsString() severity?: ObsAlertSeverity;
  @IsOptional() @IsNumber() threshold?: number;
  @IsOptional() @IsString() comparison?: string;
  @IsOptional() @IsNumber() windowSeconds?: number;
}

class UpdateAlertRuleDto {
  @IsOptional() @IsString() @MinLength(2) name?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() metricCode?: string;
  @IsOptional() @IsString() ruleType?: string;
  @IsOptional() @IsString() severity?: ObsAlertSeverity;
  @IsOptional() @IsNumber() threshold?: number;
  @IsOptional() @IsString() comparison?: string;
  @IsOptional() @IsNumber() windowSeconds?: number;
  @IsOptional() @IsBoolean() isEnabled?: boolean;
}

class CreateIncidentDto {
  @IsString() @MinLength(2) title!: string;
  @IsOptional() @IsString() summary?: string;
  @IsOptional() @IsString() severity?: ObsIncidentSeverity;
  @IsOptional() @IsString() serviceName?: string;
  @IsOptional() @IsBoolean() publicVisible?: boolean;
}

class ResolveIncidentDto {
  @IsOptional() @IsString() rootCause?: string;
  @IsOptional() @IsString() postmortem?: string;
}

class CreateSloDto {
  @IsString() @MinLength(2) code!: string;
  @IsString() @MinLength(2) name!: string;
  @IsOptional() @IsString() description?: string;
  @IsString() serviceName!: string;
  @IsString() domain!: ObsServiceDomain;
  @IsString() indicatorType!: ObsSloIndicatorType;
  @IsNumber() targetPercent!: number;
  @IsOptional() @IsNumber() latencyMsTarget?: number;
  @IsOptional() @IsNumber() windowDays?: number;
}

class RecordSliDto {
  @IsString() windowStart!: string;
  @IsString() windowEnd!: string;
  @IsNumber() goodEvents!: number;
  @IsNumber() totalEvents!: number;
}

class UpsertDependencyDto {
  @IsString() sourceService!: string;
  @IsString() targetService!: string;
  @IsOptional() @IsString() dependencyType?: string;
  @IsOptional() @IsString() domain?: ObsServiceDomain;
  @IsOptional() @IsBoolean() isCritical?: boolean;
  @IsOptional() @IsObject() metadata?: Record<string, unknown>;
}

class CreateMaintenanceDto {
  @IsString() title!: string;
  @IsString() message!: string;
  @IsOptional() @IsString() severity?: string;
  @IsString() startsAt!: string;
  @IsOptional() @IsString() endsAt?: string;
}

class UpdateMaintenanceDto {
  @IsBoolean() isActive!: boolean;
}

const _adminDtoRuntime = {
  CreateAlertRuleDto,
  UpdateAlertRuleDto,
  CreateIncidentDto,
  ResolveIncidentDto,
  CreateSloDto,
  RecordSliDto,
  UpsertDependencyDto,
  CreateMaintenanceDto,
  UpdateMaintenanceDto,
};
void _adminDtoRuntime;

@ApiTags('admin-observability')
@ApiBearerAuth()
@Roles(...ADMIN_PORTAL_ROLES)
@Controller('api/v1/admin/observability')
export class AdminObservabilityController {
  constructor(
    @Inject(OpsDashboardService) private readonly ops: OpsDashboardService,
    @Inject(MetricsService) private readonly metrics: MetricsService,
    @Inject(TracingService) private readonly tracing: TracingService,
    @Inject(LoggingService) private readonly logging: LoggingService,
    @Inject(HealthMonitorService) private readonly health: HealthMonitorService,
    @Inject(DependencyService) private readonly dependencies: DependencyService,
    @Inject(AlertingService) private readonly alerting: AlertingService,
    @Inject(IncidentService) private readonly incidents: IncidentService,
    @Inject(SloService) private readonly slos: SloService,
    @Inject(CapacityService) private readonly capacity: CapacityService,
    @Inject(MaintenanceService) private readonly maintenance: MaintenanceService,
    @Inject(AuditService) private readonly audit: AuditService,
  ) {}

  @Get('dashboard')
  @Permissions(PERMISSION_OBSERVABILITY_ADMIN)
  async dashboard() {
    return successResponse(await this.ops.overview());
  }

  @Get('metrics')
  @Permissions(PERMISSION_OBSERVABILITY_ADMIN)
  async listMetrics(@Query('domain') domain?: ObsServiceDomain) {
    return successResponse(await this.metrics.listDefinitions(domain));
  }

  @Get('metrics/:code')
  @Permissions(PERMISSION_OBSERVABILITY_ADMIN)
  async metricDetail(@Param('code') code: string) {
    return successResponse(await this.metrics.recentSamples(code));
  }

  @Get('traces')
  @Permissions(PERMISSION_OBSERVABILITY_ADMIN)
  async traces(
    @Query('serviceName') serviceName?: string,
    @Query('correlationId') correlationId?: string,
  ) {
    return successResponse(await this.tracing.search({ serviceName, correlationId }));
  }

  @Get('traces/:traceId')
  @Permissions(PERMISSION_OBSERVABILITY_ADMIN)
  async traceDetail(@Param('traceId') traceId: string) {
    return successResponse(await this.tracing.getByTraceId(traceId));
  }

  @Get('logs')
  @Permissions(PERMISSION_OBSERVABILITY_ADMIN)
  async logs(
    @Query('serviceName') serviceName?: string,
    @Query('level') level?: string,
    @Query('correlationId') correlationId?: string,
  ) {
    return successResponse(await this.logging.search({ serviceName, level, correlationId }));
  }

  @Get('health')
  @Permissions(PERMISSION_OBSERVABILITY_ADMIN)
  async healthStatus(@Query('serviceName') serviceName?: string) {
    return successResponse({
      services: await this.health.serviceStatusMap(),
      recent: await this.health.listRecent(serviceName),
    });
  }

  @Get('dependencies')
  @Permissions(PERMISSION_OBSERVABILITY_ADMIN)
  async dependencyGraph() {
    return successResponse(await this.dependencies.graph());
  }

  @Post('dependencies')
  @Permissions(PERMISSION_OBSERVABILITY_ADMIN)
  async upsertDependency(@Body() dto: UpsertDependencyDto) {
    return successResponse(await this.dependencies.upsert(dto));
  }

  @Get('alerts')
  @Permissions(PERMISSION_OBSERVABILITY_ALERTS)
  async alerts(@Query('status') status?: string) {
    return successResponse(await this.alerting.listAlerts(status));
  }

  @Get('alert-rules')
  @Permissions(PERMISSION_OBSERVABILITY_ALERTS)
  async alertRules() {
    return successResponse(await this.alerting.listRules());
  }

  @Post('alert-rules')
  @Permissions(PERMISSION_OBSERVABILITY_ALERTS)
  async createAlertRule(@Body() dto: CreateAlertRuleDto) {
    return successResponse(await this.alerting.createRule(dto));
  }

  @Patch('alert-rules/:code')
  @Permissions(PERMISSION_OBSERVABILITY_ALERTS)
  async updateAlertRule(@Param('code') code: string, @Body() dto: UpdateAlertRuleDto) {
    return successResponse(await this.alerting.updateRule(code, dto));
  }

  @Post('alerts/evaluate')
  @Permissions(PERMISSION_OBSERVABILITY_ALERTS)
  async evaluateAlerts() {
    return successResponse(await this.alerting.evaluateEnabledRules());
  }

  @Post('alerts/:id/acknowledge')
  @Permissions(PERMISSION_OBSERVABILITY_ALERTS)
  async ackAlert(@Param('id') id: string, @CurrentUser() user: JwtAccessClaims) {
    return successResponse(await this.alerting.acknowledge(id, user.sub));
  }

  @Post('alerts/:id/resolve')
  @Permissions(PERMISSION_OBSERVABILITY_ALERTS)
  async resolveAlert(@Param('id') id: string, @CurrentUser() user: JwtAccessClaims) {
    return successResponse(await this.alerting.resolve(id, user.sub));
  }

  @Get('incidents')
  @Permissions(PERMISSION_OBSERVABILITY_INCIDENTS)
  async listIncidents() {
    return successResponse(await this.incidents.list());
  }

  @Post('incidents')
  @Permissions(PERMISSION_OBSERVABILITY_INCIDENTS)
  async createIncident(@Body() dto: CreateIncidentDto, @CurrentUser() user: JwtAccessClaims) {
    return successResponse(await this.incidents.create({ ...dto, reporterUserId: user.sub }));
  }

  @Get('incidents/:id')
  @Permissions(PERMISSION_OBSERVABILITY_INCIDENTS)
  async getIncident(@Param('id') id: string) {
    return successResponse(await this.incidents.get(id));
  }

  @Post('incidents/:id/acknowledge')
  @Permissions(PERMISSION_OBSERVABILITY_INCIDENTS)
  async ackIncident(@Param('id') id: string, @CurrentUser() user: JwtAccessClaims) {
    return successResponse(await this.incidents.acknowledge(id, user.sub));
  }

  @Post('incidents/:id/assign')
  @Permissions(PERMISSION_OBSERVABILITY_INCIDENTS)
  async assignIncident(
    @Param('id') id: string,
    @Body() body: { assigneeUserId: string },
    @CurrentUser() user: JwtAccessClaims,
  ) {
    return successResponse(await this.incidents.assign(id, body.assigneeUserId, user.sub));
  }

  @Post('incidents/:id/escalate')
  @Permissions(PERMISSION_OBSERVABILITY_INCIDENTS)
  async escalateIncident(
    @Param('id') id: string,
    @Body() body: { severity: ObsIncidentSeverity },
    @CurrentUser() user: JwtAccessClaims,
  ) {
    return successResponse(await this.incidents.escalate(id, body.severity, user.sub));
  }

  @Post('incidents/:id/resolve')
  @Permissions(PERMISSION_OBSERVABILITY_INCIDENTS)
  async resolveIncident(
    @Param('id') id: string,
    @Body() dto: ResolveIncidentDto,
    @CurrentUser() user: JwtAccessClaims,
  ) {
    return successResponse(await this.incidents.resolve(id, { ...dto, actorUserId: user.sub }));
  }

  @Get('slos')
  @Permissions(PERMISSION_OBSERVABILITY_SLO)
  async listSlos() {
    return successResponse(await this.slos.list());
  }

  @Get('slos/compliance')
  @Permissions(PERMISSION_OBSERVABILITY_SLO)
  async sloCompliance() {
    return successResponse(await this.slos.complianceReport());
  }

  @Post('slos')
  @Permissions(PERMISSION_OBSERVABILITY_SLO)
  async createSlo(@Body() dto: CreateSloDto) {
    return successResponse(await this.slos.create(dto));
  }

  @Post('slos/:code/measurements')
  @Permissions(PERMISSION_OBSERVABILITY_SLO)
  async recordSli(@Param('code') code: string, @Body() dto: RecordSliDto) {
    return successResponse(
      await this.slos.recordMeasurement({
        code,
        windowStart: new Date(dto.windowStart),
        windowEnd: new Date(dto.windowEnd),
        goodEvents: dto.goodEvents,
        totalEvents: dto.totalEvents,
      }),
    );
  }

  @Get('capacity')
  @Permissions(PERMISSION_OBSERVABILITY_ADMIN)
  async capacityOverview(@Query('serviceName') serviceName?: string) {
    return successResponse({
      latest: await this.capacity.latestByService(),
      samples: await this.capacity.list(serviceName),
      forecast: serviceName ? await this.capacity.forecast(serviceName) : null,
    });
  }

  @Get('maintenance')
  @Permissions(PERMISSION_OBSERVABILITY_ADMIN)
  async listMaintenance() {
    return successResponse(await this.maintenance.listAll());
  }

  @Post('maintenance')
  @Permissions(PERMISSION_OBSERVABILITY_ADMIN)
  async createMaintenance(@Body() dto: CreateMaintenanceDto) {
    return successResponse(
      await this.maintenance.create({
        ...dto,
        startsAt: new Date(dto.startsAt),
        endsAt: dto.endsAt ? new Date(dto.endsAt) : undefined,
      }),
    );
  }

  @Patch('maintenance/:id')
  @Permissions(PERMISSION_OBSERVABILITY_ADMIN)
  async updateMaintenance(@Param('id') id: string, @Body() body: UpdateMaintenanceDto) {
    return successResponse(await this.maintenance.setActive(id, body.isActive));
  }

  @Get('audit')
  @Permissions(PERMISSION_OBSERVABILITY_ADMIN)
  async auditTrail(@Query('skip') skip?: string, @Query('take') take?: string) {
    return successResponse(
      await this.audit.list(skip ? Number(skip) : 0, take ? Number(take) : 50),
    );
  }
}
