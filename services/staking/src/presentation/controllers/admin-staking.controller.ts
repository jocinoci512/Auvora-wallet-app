import { Controller, Get, Inject } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { StakingDashboardService } from '../../application/services/staking-dashboard.service';
import { StakingWorkersService } from '../../application/services/staking-workers.service';
import { STAKING_PERMISSIONS } from '../../domain/permission-codes';
import { Permissions, Roles } from '../decorators/auth.decorators';
import { successResponse } from '@auvora/nest-common';

@ApiTags('admin-staking')
@ApiBearerAuth()
@Controller('api/v1/admin/staking')
export class AdminStakingController {
  constructor(
    @Inject(StakingDashboardService) private readonly dashboard: StakingDashboardService,
    @Inject(StakingWorkersService) private readonly workers: StakingWorkersService,
  ) {}

  @Get('providers')
  @Roles('admin', 'super_admin')
  @Permissions(STAKING_PERMISSIONS.ADMIN)
  async providers() {
    return successResponse(await this.dashboard.providers());
  }

  @Get('validators')
  @Roles('admin', 'super_admin')
  @Permissions(STAKING_PERMISSIONS.ADMIN)
  async validators() {
    return successResponse(await this.dashboard.validators());
  }

  @Get('rewards')
  @Roles('admin', 'super_admin')
  @Permissions(STAKING_PERMISSIONS.ADMIN)
  async rewards() {
    return successResponse(await this.dashboard.rewards());
  }

  @Get('sync-status')
  @Roles('admin', 'super_admin')
  @Permissions(STAKING_PERMISSIONS.ADMIN)
  async syncStatus() {
    return successResponse(await this.dashboard.syncStatus());
  }

  @Get('workers')
  @Roles('admin', 'super_admin')
  @Permissions(STAKING_PERMISSIONS.ADMIN)
  workersHealth() {
    return successResponse(this.workers.status());
  }
}
