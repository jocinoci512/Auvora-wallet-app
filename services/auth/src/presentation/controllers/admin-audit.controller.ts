import { Controller, Get, Inject, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AuthService } from '../../application/services/auth.service';
import { PERMISSION_AUDIT_READ, ROLE_ADMIN, ROLE_SUPER_ADMIN } from '../../domain/permission-codes';
import { Permissions, Roles } from '../decorators/auth.decorators';
import { successResponse } from '@auvora/nest-common';
import { AdminAuditQueryDto } from '../dto/admin.dto';
import type { AuditAction } from '../../application/ports/audit-repository.port';

const _adminAuditDtoRuntime = { AdminAuditQueryDto };
void _adminAuditDtoRuntime;

@ApiTags('admin-audit')
@Controller('api/v1/admin/audit')
@Roles(ROLE_ADMIN, ROLE_SUPER_ADMIN)
export class AdminAuditController {
  constructor(@Inject(AuthService) private readonly authService: AuthService) {}

  @Get()
  @Permissions(PERMISSION_AUDIT_READ)
  async listAudit(@Query() query: AdminAuditQueryDto) {
    const data = await this.authService.adminListAudit({
      action: query.action as AuditAction | undefined,
      actorUserId: query.actorUserId,
      targetUserId: query.targetUserId,
      skip: query.skip,
      take: query.take,
    });
    return successResponse(data);
  }
}
