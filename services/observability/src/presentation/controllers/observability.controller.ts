import { Controller, Get, Inject, Param } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { IncidentService } from '../../application/services/incident.service';
import { MaintenanceService } from '../../application/services/maintenance.service';
import { OpsDashboardService } from '../../application/services/ops-dashboard.service';
import { PERMISSION_OBSERVABILITY_READ } from '../../domain';
import { successResponse } from '@auvora/nest-common';
import { Permissions, Public } from '../decorators/auth.decorators';

@ApiTags('observability')
@Controller('api/v1/observability')
export class ObservabilityController {
  constructor(
    @Inject(OpsDashboardService) private readonly ops: OpsDashboardService,
    @Inject(MaintenanceService) private readonly maintenance: MaintenanceService,
    @Inject(IncidentService) private readonly incidents: IncidentService,
  ) {}

  @Public()
  @Get('status')
  async status() {
    return successResponse(await this.ops.publicStatus());
  }

  @Public()
  @Get('maintenance')
  async maintenanceNotices() {
    return successResponse(await this.maintenance.listActive());
  }

  @ApiBearerAuth()
  @Get('incidents')
  @Permissions(PERMISSION_OBSERVABILITY_READ)
  async publicIncidents() {
    return successResponse(await this.incidents.list({ publicOnly: true }));
  }

  @ApiBearerAuth()
  @Get('incidents/:code')
  @Permissions(PERMISSION_OBSERVABILITY_READ)
  async getIncident(@Param('code') code: string) {
    const incident = await this.incidents.get(code);
    if (!incident.publicVisible) {
      return successResponse(incident);
    }
    return successResponse(incident);
  }
}
