import { Controller, Get, Inject } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { successResponse } from '@auvora/nest-common';
import { AdminSystemHealthService } from '../../application/services/admin-system-health.service';
import { ADMIN_PORTAL_ROLES, PERMISSION_HEALTH_READ } from '../../domain/permission-codes';
import { Permissions, Roles } from '../decorators/auth.decorators';

@ApiTags('admin-system-health')
@Controller('api/v1/admin/system-health')
@Roles(...ADMIN_PORTAL_ROLES)
export class AdminSystemHealthController {
  constructor(
    @Inject(AdminSystemHealthService) private readonly health: AdminSystemHealthService,
  ) {}

  @Get()
  @Permissions(PERMISSION_HEALTH_READ)
  async getProductionHealth() {
    return successResponse(await this.health.getProductionHealth());
  }
}
