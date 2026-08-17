import { Controller, Get, Inject } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { SwapDashboardService } from '../../application/services/swap-dashboard.service';
import { Permissions, Roles } from '../decorators/auth.decorators';
import { successResponse } from '@auvora/nest-common';
import { ADMIN_PORTAL_ROLES } from '@auvora/types';
import { SWAP_PERMISSIONS } from '../../domain/permission-codes';

@ApiTags('admin-swaps')
@ApiBearerAuth()
@Controller('api/v1/admin/swaps')
export class AdminSwapsController {
  constructor(@Inject(SwapDashboardService) private readonly dashboard: SwapDashboardService) {}

  @Get('providers')
  @Roles(...ADMIN_PORTAL_ROLES)
  @Permissions(SWAP_PERMISSIONS.ADMIN)
  async providers() {
    return successResponse(await this.dashboard.providers());
  }

  @Get('analytics')
  @Roles(...ADMIN_PORTAL_ROLES)
  @Permissions(SWAP_PERMISSIONS.ADMIN)
  async analytics() {
    return successResponse(await this.dashboard.analytics());
  }

  @Get('health')
  @Roles(...ADMIN_PORTAL_ROLES)
  @Permissions(SWAP_PERMISSIONS.ADMIN)
  async health() {
    return successResponse(await this.dashboard.providers());
  }

  @Get('routes')
  @Roles(...ADMIN_PORTAL_ROLES)
  @Permissions(SWAP_PERMISSIONS.ADMIN)
  async routes() {
    return successResponse(await this.dashboard.routesMonitor());
  }

  @Get('failures')
  @Roles(...ADMIN_PORTAL_ROLES)
  @Permissions(SWAP_PERMISSIONS.ADMIN)
  async failures() {
    return successResponse(await this.dashboard.failures());
  }
}
