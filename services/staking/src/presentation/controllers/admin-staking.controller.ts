import { Controller, Get, Inject } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { StakingDashboardService } from '../../application/services/staking-dashboard.service';
import { StakingWorkersService } from '../../application/services/staking-workers.service';
import { STAKING_PERMISSIONS } from '../../domain/permission-codes';
import { Permissions, Roles } from '../decorators/auth.decorators';
import { successResponse } from '@auvora/nest-common';
import { ADMIN_PORTAL_ROLES } from '@auvora/types';

@ApiTags('admin-staking')
@ApiBearerAuth()
@Controller('api/v1/admin/staking')
export class AdminStakingController {
  constructor(
    @Inject(StakingDashboardService) private readonly dashboard: StakingDashboardService,
    @Inject(StakingWorkersService) private readonly workers: StakingWorkersService,
  ) {}

  @Get('providers')
  @Roles(...ADMIN_PORTAL_ROLES)
  @Permissions(STAKING_PERMISSIONS.ADMIN)
  async providers() {
    return successResponse(await this.dashboard.providers());
  }

  @Get('validators')
  @Roles(...ADMIN_PORTAL_ROLES)
  @Permissions(STAKING_PERMISSIONS.ADMIN)
  async validators() {
    return successResponse(await this.dashboard.validators());
  }

  @Get('rewards')
  @Roles(...ADMIN_PORTAL_ROLES)
  @Permissions(STAKING_PERMISSIONS.ADMIN)
  async rewards() {
    return successResponse(await this.dashboard.rewards());
  }

  @Get('sync-status')
  @Roles(...ADMIN_PORTAL_ROLES)
  @Permissions(STAKING_PERMISSIONS.ADMIN)
  async syncStatus() {
    return successResponse(await this.dashboard.syncStatus());
  }

  @Get('workers')
  @Roles(...ADMIN_PORTAL_ROLES)
  @Permissions(STAKING_PERMISSIONS.ADMIN)
  workersHealth() {
    return successResponse(this.workers.status());
  }
}
