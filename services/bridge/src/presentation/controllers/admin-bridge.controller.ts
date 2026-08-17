import { Controller, Get, Inject } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { BridgeDashboardService } from '../../application/services/bridge-dashboard.service';
import { BridgeWorkersService } from '../../application/services/bridge-workers.service';
import { BRIDGE_PERMISSIONS } from '../../domain/permission-codes';
import { Permissions, Roles } from '../decorators/auth.decorators';
import { successResponse } from '@auvora/nest-common';
import { ADMIN_PORTAL_ROLES } from '@auvora/types';

@ApiTags('admin-bridge')
@ApiBearerAuth()
@Controller('api/v1/admin/bridge')
export class AdminBridgeController {
  constructor(
    @Inject(BridgeDashboardService) private readonly dashboard: BridgeDashboardService,
    @Inject(BridgeWorkersService) private readonly workers: BridgeWorkersService,
  ) {}

  @Get('providers')
  @Roles(...ADMIN_PORTAL_ROLES)
  @Permissions(BRIDGE_PERMISSIONS.ADMIN)
  async providers() {
    return successResponse(await this.dashboard.providers());
  }

  @Get('routes')
  @Roles(...ADMIN_PORTAL_ROLES)
  @Permissions(BRIDGE_PERMISSIONS.ADMIN)
  async routes() {
    return successResponse(await this.dashboard.routes());
  }

  @Get('failures')
  @Roles(...ADMIN_PORTAL_ROLES)
  @Permissions(BRIDGE_PERMISSIONS.ADMIN)
  async failures() {
    return successResponse(await this.dashboard.failures());
  }

  @Get('sync-status')
  @Roles(...ADMIN_PORTAL_ROLES)
  @Permissions(BRIDGE_PERMISSIONS.ADMIN)
  async syncStatus() {
    return successResponse(await this.dashboard.syncStatus());
  }

  @Get('workers')
  @Roles(...ADMIN_PORTAL_ROLES)
  @Permissions(BRIDGE_PERMISSIONS.ADMIN)
  workersHealth() {
    return successResponse(this.workers.status());
  }
}
