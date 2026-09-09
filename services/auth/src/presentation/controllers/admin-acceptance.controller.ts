import { Controller, Inject, Param, Post, Req } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { IsUUID } from 'class-validator';
import {
  ADMIN_PORTAL_ROLES,
  PERMISSION_USERS_WRITE,
  ROLE_SUPER_ADMIN,
} from '../../domain/permission-codes';
import { Permissions, RequireStepUp, Roles } from '../decorators/auth.decorators';
import { CurrentUser, extractRequestContext } from '../decorators/current-user.decorator';
import type { JwtAccessClaims } from '@auvora/types';
import { successResponse } from '@auvora/nest-common';
import { AcceptanceAdminService } from '../../application/services/acceptance-admin.service';

class UserIdParamDto {
  @IsUUID()
  userId!: string;
}
void UserIdParamDto;

@ApiTags('admin-acceptance')
@Controller('api/v1/admin/acceptance/users')
@Roles(ROLE_SUPER_ADMIN)
export class AdminAcceptanceController {
  constructor(
    @Inject(AcceptanceAdminService) private readonly acceptance: AcceptanceAdminService,
  ) {}

  @Post(':userId/verify-email')
  @Permissions(PERMISSION_USERS_WRITE)
  @RequireStepUp()
  async verifyEmail(
    @CurrentUser() actor: JwtAccessClaims,
    @Param() params: UserIdParamDto,
    @Req() req: Request,
  ) {
    const data = await this.acceptance.verifyEmail({
      actorUserId: actor.sub,
      actorRoles: actor.roles ?? [],
      userId: params.userId,
      ctx: extractRequestContext(req),
    });
    return successResponse(data);
  }

  @Post(':userId/cleanup')
  @Permissions(PERMISSION_USERS_WRITE)
  @RequireStepUp()
  async cleanup(
    @CurrentUser() actor: JwtAccessClaims,
    @Param() params: UserIdParamDto,
    @Req() req: Request,
  ) {
    const data = await this.acceptance.cleanup({
      actorUserId: actor.sub,
      actorRoles: actor.roles ?? [],
      userId: params.userId,
      ctx: extractRequestContext(req),
    });
    return successResponse(data);
  }

  @Post(':userId/mint-password-reset-token')
  @Permissions(PERMISSION_USERS_WRITE)
  @RequireStepUp()
  async mintPasswordResetToken(
    @CurrentUser() actor: JwtAccessClaims,
    @Param() params: UserIdParamDto,
    @Req() req: Request,
  ) {
    const data = await this.acceptance.mintPasswordResetToken({
      actorUserId: actor.sub,
      actorRoles: actor.roles ?? [],
      userId: params.userId,
      ctx: extractRequestContext(req),
    });
    return successResponse(data);
  }
}

class RequestIdParamDto {
  @IsUUID()
  requestId!: string;
}
void RequestIdParamDto;

@ApiTags('admin-acceptance')
@Controller('api/v1/admin/acceptance/vault-recovery')
@Roles(ROLE_SUPER_ADMIN)
export class AdminAcceptanceVaultRecoveryController {
  constructor(
    @Inject(AcceptanceAdminService) private readonly acceptance: AcceptanceAdminService,
  ) {}

  @Post(':requestId/force-expire')
  @Permissions(PERMISSION_USERS_WRITE)
  @RequireStepUp()
  async forceExpire(
    @CurrentUser() actor: JwtAccessClaims,
    @Param() params: RequestIdParamDto,
    @Req() req: Request,
  ) {
    const data = await this.acceptance.forceExpireVaultRecoveryRequest({
      actorUserId: actor.sub,
      actorRoles: actor.roles ?? [],
      requestId: params.requestId,
      ctx: extractRequestContext(req),
    });
    return successResponse(data);
  }
}

// Silence unused import if Roles spread needs ADMIN_PORTAL_ROLES elsewhere
void ADMIN_PORTAL_ROLES;
