import {
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  Param,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { AuthService } from '../../application/services/auth.service';
import {
  ADMIN_PORTAL_ROLES,
  PERMISSION_ROLES_MANAGE,
  PERMISSION_SESSIONS_REVOKE,
  PERMISSION_USERS_DELETE,
  PERMISSION_USERS_READ,
  PERMISSION_USERS_WRITE,
} from '../../domain/permission-codes';
import { Permissions, RequireStepUp, Roles } from '../decorators/auth.decorators';
import { CurrentUser, extractRequestContext } from '../decorators/current-user.decorator';
import type { JwtAccessClaims } from '@auvora/types';
import { successResponse } from '@auvora/nest-common';
import {
  AdminAssignRolesDto,
  AdminSearchUsersQueryDto,
  AdminToggleMfaDto,
  AdminUpdateStatusDto,
  UserIdParamDto,
} from '../dto/admin.dto';

const _adminUsersDtoRuntime = {
  AdminAssignRolesDto,
  AdminSearchUsersQueryDto,
  AdminToggleMfaDto,
  AdminUpdateStatusDto,
  UserIdParamDto,
};
void _adminUsersDtoRuntime;

@ApiTags('admin-users')
@Controller('api/v1/admin/users')
@Roles(...ADMIN_PORTAL_ROLES)
export class AdminUsersController {
  constructor(@Inject(AuthService) private readonly authService: AuthService) {}

  @Get()
  @Permissions(PERMISSION_USERS_READ)
  async searchUsers(@Query() query: AdminSearchUsersQueryDto) {
    const data = await this.authService.adminSearchUsers(query);
    return successResponse(data);
  }

  @Get(':userId')
  @Permissions(PERMISSION_USERS_READ)
  async getUser(@Param() params: UserIdParamDto) {
    const data = await this.authService.adminGetUser(params.userId);
    return successResponse(data);
  }

  @Get(':userId/devices')
  @Permissions(PERMISSION_USERS_READ)
  async getUserDevices(@Param() params: UserIdParamDto) {
    const data = await this.authService.adminListDevices(params.userId);
    return successResponse(data);
  }

  @Get(':userId/sessions')
  @Permissions(PERMISSION_USERS_READ)
  async getUserSessions(@Param() params: UserIdParamDto) {
    const data = await this.authService.adminListSessions(params.userId);
    return successResponse(data);
  }

  @Patch(':userId/status')
  @Permissions(PERMISSION_USERS_WRITE)
  async updateStatus(
    @CurrentUser() actor: JwtAccessClaims,
    @Param() params: UserIdParamDto,
    @Body() dto: AdminUpdateStatusDto,
    @Req() req: Request,
  ) {
    const data = await this.authService.adminUpdateStatus(
      actor.sub,
      params.userId,
      dto.status,
      extractRequestContext(req),
    );
    return successResponse(data);
  }

  @Delete(':userId')
  @Permissions(PERMISSION_USERS_DELETE)
  async softDelete(
    @CurrentUser() actor: JwtAccessClaims,
    @Param() params: UserIdParamDto,
    @Req() req: Request,
  ) {
    const data = await this.authService.adminSoftDelete(
      actor.sub,
      params.userId,
      extractRequestContext(req),
    );
    return successResponse(data);
  }

  @Post(':userId/restore')
  @Permissions(PERMISSION_USERS_WRITE)
  async restore(
    @CurrentUser() actor: JwtAccessClaims,
    @Param() params: UserIdParamDto,
    @Req() req: Request,
  ) {
    const data = await this.authService.adminRestore(
      actor.sub,
      params.userId,
      extractRequestContext(req),
    );
    return successResponse(data);
  }

  @Patch(':userId/roles')
  @Permissions(PERMISSION_ROLES_MANAGE)
  @RequireStepUp()
  async assignRoles(
    @CurrentUser() actor: JwtAccessClaims,
    @Param() params: UserIdParamDto,
    @Body() dto: AdminAssignRolesDto,
    @Req() req: Request,
  ) {
    const data = await this.authService.adminAssignRoles(
      actor.sub,
      params.userId,
      dto.roles,
      extractRequestContext(req),
    );
    return successResponse(data);
  }

  @Post(':userId/force-logout')
  @Permissions(PERMISSION_SESSIONS_REVOKE)
  @RequireStepUp()
  async forceLogout(
    @CurrentUser() actor: JwtAccessClaims,
    @Param() params: UserIdParamDto,
    @Req() req: Request,
  ) {
    const data = await this.authService.adminForceLogout(
      actor.sub,
      params.userId,
      extractRequestContext(req),
    );
    return successResponse(data);
  }

  @Patch(':userId/mfa')
  @Permissions(PERMISSION_USERS_WRITE)
  async toggleMfa(
    @CurrentUser() actor: JwtAccessClaims,
    @Param() params: UserIdParamDto,
    @Body() dto: AdminToggleMfaDto,
    @Req() req: Request,
  ) {
    const data = await this.authService.adminToggleMfa(
      actor.sub,
      params.userId,
      dto.enabled,
      extractRequestContext(req),
    );
    return successResponse(data);
  }
}
