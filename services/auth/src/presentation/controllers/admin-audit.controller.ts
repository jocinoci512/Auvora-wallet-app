import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { type AuthService } from '../../application/services/auth.service';
import { PERMISSION_AUDIT_READ, ROLE_ADMIN } from '../../domain/permission-codes';
import { Permissions, Roles } from '../decorators/auth.decorators';
import { successResponse } from '../common/api-response';
import { type AdminAuditQueryDto } from '../dto/admin.dto';
import type { AuditAction } from '../../application/ports/audit-repository.port';

@ApiTags('admin-audit')
@Controller('api/v1/admin/audit')
@Roles(ROLE_ADMIN)
export class AdminAuditController {
  constructor(private readonly authService: AuthService) {}

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
