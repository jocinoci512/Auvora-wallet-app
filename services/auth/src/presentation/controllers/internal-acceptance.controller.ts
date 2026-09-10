import { Controller, Get, Inject, Param, Post, Req, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { IsUUID } from 'class-validator';
import { Public } from '../decorators/auth.decorators';
import { extractRequestContext } from '../decorators/current-user.decorator';
import { successResponse } from '@auvora/nest-common';
import { AcceptanceAdminService } from '../../application/services/acceptance-admin.service';
import { AcceptanceRunnerGuard } from '../guards/acceptance-runner.guard';
import { ROLE_SUPER_ADMIN } from '../../domain/permission-codes';

class UserIdParamDto {
  @IsUUID()
  userId!: string;
}
void UserIdParamDto;

class RequestIdParamDto {
  @IsUUID()
  requestId!: string;
}
void RequestIdParamDto;

const ACCEPTANCE_ACTOR = {
  actorUserId: 'system:acceptance-runner',
  actorRoles: [ROLE_SUPER_ADMIN],
} as const;

@ApiTags('internal-acceptance')
@Public()
@UseGuards(AcceptanceRunnerGuard)
@Controller('api/v1/internal/acceptance')
export class InternalAcceptanceController {
  constructor(
    @Inject(AcceptanceAdminService) private readonly acceptance: AcceptanceAdminService,
  ) {}

  @Post('users/:userId/bootstrap')
  async bootstrap(@Param() params: UserIdParamDto, @Req() req: Request) {
    const data = await this.acceptance.bootstrapAcceptanceUser({
      ...ACCEPTANCE_ACTOR,
      userId: params.userId,
      ctx: extractRequestContext(req),
    });
    return successResponse(data);
  }

  @Post('users/:userId/mint-password-reset-token')
  async mintPasswordResetToken(@Param() params: UserIdParamDto, @Req() req: Request) {
    const data = await this.acceptance.mintPasswordResetToken({
      ...ACCEPTANCE_ACTOR,
      userId: params.userId,
      ctx: extractRequestContext(req),
    });
    return successResponse(data);
  }

  @Post('users/:userId/cleanup')
  async cleanup(@Param() params: UserIdParamDto, @Req() req: Request) {
    const data = await this.acceptance.cleanup({
      ...ACCEPTANCE_ACTOR,
      userId: params.userId,
      ctx: extractRequestContext(req),
    });
    return successResponse(data);
  }

  @Post('vault-recovery/:requestId/force-expire')
  async forceExpire(@Param() params: RequestIdParamDto, @Req() req: Request) {
    const data = await this.acceptance.forceExpireVaultRecoveryRequest({
      ...ACCEPTANCE_ACTOR,
      requestId: params.requestId,
      ctx: extractRequestContext(req),
    });
    return successResponse(data);
  }

  @Get('users/:userId/safe-status')
  async safeStatus(@Param() params: UserIdParamDto) {
    const data = await this.acceptance.getSafeUserStatus({
      ...ACCEPTANCE_ACTOR,
      userId: params.userId,
    });
    return successResponse(data);
  }
}
