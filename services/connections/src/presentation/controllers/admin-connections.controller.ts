import { Controller, Get, Inject } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ConnectionsDashboardService } from '../../application/services/connections-dashboard.service';
import { ConnectionsWorkersService } from '../../application/services/connections-workers.service';
import { CONNECTIONS_PERMISSIONS } from '../../domain/permission-codes';
import { Permissions, Roles } from '../decorators/auth.decorators';
import { successResponse } from '@auvora/nest-common';
import { ADMIN_PORTAL_ROLES } from '@auvora/types';

@ApiTags('admin-connections')
@ApiBearerAuth()
@Controller('api/v1/admin/connections')
export class AdminConnectionsController {
  constructor(
    @Inject(ConnectionsDashboardService) private readonly dashboard: ConnectionsDashboardService,
    @Inject(ConnectionsWorkersService) private readonly workers: ConnectionsWorkersService,
  ) {}

  @Get('providers')
  @Roles(...ADMIN_PORTAL_ROLES)
  @Permissions(CONNECTIONS_PERMISSIONS.ADMIN)
  async providers() {
    return successResponse(await this.dashboard.providers());
  }

  @Get('connections')
  @Roles(...ADMIN_PORTAL_ROLES)
  @Permissions(CONNECTIONS_PERMISSIONS.ADMIN)
  async connections() {
    return successResponse(await this.dashboard.connections());
  }

  @Get('sessions')
  @Roles(...ADMIN_PORTAL_ROLES)
  @Permissions(CONNECTIONS_PERMISSIONS.ADMIN)
  async sessions() {
    return successResponse(await this.dashboard.sessions());
  }

  @Get('devices')
  @Roles(...ADMIN_PORTAL_ROLES)
  @Permissions(CONNECTIONS_PERMISSIONS.ADMIN)
  async devices() {
    return successResponse(await this.dashboard.devices());
  }

  @Get('sync-status')
  @Roles(...ADMIN_PORTAL_ROLES)
  @Permissions(CONNECTIONS_PERMISSIONS.ADMIN)
  async syncStatus() {
    return successResponse(await this.dashboard.syncStatus());
  }

  @Get('workers')
  @Roles(...ADMIN_PORTAL_ROLES)
  @Permissions(CONNECTIONS_PERMISSIONS.ADMIN)
  workersHealth() {
    return successResponse(this.workers.status());
  }

  @Get('dapps/analytics')
  @Roles(...ADMIN_PORTAL_ROLES)
  @Permissions(CONNECTIONS_PERMISSIONS.ADMIN)
  async dappAnalytics() {
    return successResponse(await this.dashboard.dappAnalytics());
  }
}
