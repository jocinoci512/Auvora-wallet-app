import { Body, Controller, Get, Inject, Param, Patch, Post, Query, Req } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { successResponse } from '@auvora/nest-common';
import type { JwtAccessClaims } from '@auvora/types';
import { AdminAuthService } from '../../application/services/admin-auth.service';
import {
  ADMIN_PORTAL_ROLES,
  PERMISSION_ADMINS_MANAGE,
  PERMISSION_ADMINS_READ,
  PERMISSION_ROLES_MANAGE,
  PERMISSION_SESSIONS_REVOKE,
} from '../../domain/permission-codes';
import { Permissions, RequireStepUp, Roles } from '../decorators/auth.decorators';
import { CurrentUser, extractRequestContext } from '../decorators/current-user.decorator';
import {
  AdminAssignRolesDto,
  AdminSearchUsersQueryDto,
  AdminUpdateStatusDto,
  UserIdParamDto,
} from '../dto/admin.dto';
import { AdminOperatorReasonDto } from '../dto/admin-auth.dto';

const _dto = {
  AdminAssignRolesDto,
  AdminSearchUsersQueryDto,
  AdminUpdateStatusDto,
  UserIdParamDto,
  AdminOperatorReasonDto,
};
void _dto;

@ApiTags('admin-operators')
@Controller('api/v1/admin/operators')
@Roles(...ADMIN_PORTAL_ROLES)
export class AdminOperatorsController {
  constructor(@Inject(AdminAuthService) private readonly adminAuth: AdminAuthService) {}

  @Get()
  @Permissions(PERMISSION_ADMINS_READ)
  async list(@Query() query: AdminSearchUsersQueryDto) {
    const data = await this.adminAuth.listOperators(query);
    return successResponse({
      total: data.total,
      operators: data.operators.map((row) => this.adminAuth.serializeOperator(row)),
    });
  }

  @Get(':userId')
  @Permissions(PERMISSION_ADMINS_READ)
  async get(@Param() params: UserIdParamDto) {
    const data = await this.adminAuth.getOperator(params.userId);
    return successResponse(this.adminAuth.serializeOperator(data));
  }

  @Patch(':userId/roles')
  @Permissions(PERMISSION_ROLES_MANAGE)
  @RequireStepUp()
  async assignRoles(
    @CurrentUser() actor: JwtAccessClaims,
    @Param() params: UserIdParamDto,
    @Body() dto: AdminAssignRolesDto & AdminOperatorReasonDto,
    @Req() req: Request,
  ) {
    const data = await this.adminAuth.assignOperatorRoles(
      actor.sub,
      params.userId,
      dto.roles,
      dto.reason,
      extractRequestContext(req),
    );
    return successResponse(this.adminAuth.serializeOperator(data));
  }

  @Patch(':userId/status')
  @Permissions(PERMISSION_ADMINS_MANAGE)
  @RequireStepUp()
  async updateStatus(
    @CurrentUser() actor: JwtAccessClaims,
    @Param() params: UserIdParamDto,
    @Body() dto: AdminUpdateStatusDto & AdminOperatorReasonDto,
    @Req() req: Request,
  ) {
    const data = await this.adminAuth.updateOperatorStatus(
      actor.sub,
      params.userId,
      dto.status,
      dto.reason,
      extractRequestContext(req),
    );
    return successResponse(this.adminAuth.serializeOperator(data));
  }

  @Post(':userId/revoke-sessions')
  @Permissions(PERMISSION_SESSIONS_REVOKE)
  @RequireStepUp()
  async revokeSessions(
    @CurrentUser() actor: JwtAccessClaims,
    @Param() params: UserIdParamDto,
    @Body() dto: AdminOperatorReasonDto,
    @Req() req: Request,
  ) {
    const data = await this.adminAuth.revokeOperatorSessions(
      actor.sub,
      params.userId,
      dto.reason,
      extractRequestContext(req),
    );
    return successResponse(data);
  }

  @Post(':userId/mfa/reset')
  @Permissions(PERMISSION_ADMINS_MANAGE)
  @RequireStepUp()
  async resetMfa(
    @CurrentUser() actor: JwtAccessClaims,
    @Param() params: UserIdParamDto,
    @Body() dto: AdminOperatorReasonDto,
    @Req() req: Request,
  ) {
    const data = await this.adminAuth.resetOperatorMfa(
      actor.sub,
      params.userId,
      dto.reason,
      extractRequestContext(req),
    );
    return successResponse(this.adminAuth.serializeOperator(data));
  }
}
