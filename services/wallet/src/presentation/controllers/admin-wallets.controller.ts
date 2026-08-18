import { Body, Controller, Get, Inject, Param, Post, Query } from '@nestjs/common';
import { ApiBody, ApiTags } from '@nestjs/swagger';
import { type WalletStatus } from '@auvora/database';
import type { JwtAccessClaims } from '@auvora/types';
import { WalletService } from '../../application/services/wallet.service';
import {
  PERMISSION_WALLETS_ARCHIVE,
  PERMISSION_WALLETS_READ,
  PERMISSION_WALLETS_SUSPEND,
  ADMIN_PORTAL_ROLES,
} from '../../domain/permission-codes';
import { Permissions, RequireStepUp, Roles } from '../decorators/auth.decorators';
import { CurrentUser } from '../decorators/current-user.decorator';
import { successResponse } from '@auvora/nest-common';
import {
  AdminSearchWalletsQueryDto,
  PaginationQueryDto,
  StatusChangeDto,
  WalletIdParamDto,
} from '../dto/wallet.dto';

const _adminWalletDtoRuntime = {
  AdminSearchWalletsQueryDto,
  PaginationQueryDto,
  StatusChangeDto,
  WalletIdParamDto,
};
void _adminWalletDtoRuntime;

@ApiTags('admin-wallets')
@Controller('api/v1/admin/wallets')
@Roles(...ADMIN_PORTAL_ROLES)
export class AdminWalletsController {
  constructor(@Inject(WalletService) private readonly walletService: WalletService) {}

  @Get()
  @Permissions(PERMISSION_WALLETS_READ)
  async list(@Query() query: AdminSearchWalletsQueryDto) {
    const data = await this.walletService.adminList({
      ownerUserId: query.ownerUserId,
      assetCode: query.assetCode,
      status: query.status as WalletStatus | undefined,
      skip: query.skip ?? 0,
      take: query.take ?? 50,
    });
    return successResponse(data);
  }

  @Get(':walletId')
  @Permissions(PERMISSION_WALLETS_READ)
  async get(@Param() params: WalletIdParamDto) {
    const data = await this.walletService.adminGet(params.walletId);
    return successResponse(data);
  }

  @Post(':walletId/suspend')
  @Permissions(PERMISSION_WALLETS_SUSPEND)
  @RequireStepUp()
  @ApiBody({ type: StatusChangeDto })
  async suspend(
    @CurrentUser() actor: JwtAccessClaims,
    @Param() params: WalletIdParamDto,
    @Body() dto: StatusChangeDto,
  ) {
    const data = await this.walletService.adminSuspend(params.walletId, actor.sub, dto.reason);
    return successResponse(data);
  }

  @Post(':walletId/restore')
  @Permissions(PERMISSION_WALLETS_SUSPEND)
  @RequireStepUp()
  @ApiBody({ type: StatusChangeDto })
  async restore(
    @CurrentUser() actor: JwtAccessClaims,
    @Param() params: WalletIdParamDto,
    @Body() dto: StatusChangeDto,
  ) {
    const data = await this.walletService.adminRestore(params.walletId, actor.sub, dto.reason);
    return successResponse(data);
  }

  @Post(':walletId/archive')
  @Permissions(PERMISSION_WALLETS_ARCHIVE)
  @RequireStepUp()
  @ApiBody({ type: StatusChangeDto })
  async archive(
    @CurrentUser() actor: JwtAccessClaims,
    @Param() params: WalletIdParamDto,
    @Body() dto: StatusChangeDto,
  ) {
    const data = await this.walletService.adminArchive(params.walletId, actor.sub, dto.reason);
    return successResponse(data);
  }

  @Get(':walletId/balance')
  @Permissions(PERMISSION_WALLETS_READ)
  async getBalance(@Param() params: WalletIdParamDto, @CurrentUser() actor: JwtAccessClaims) {
    const data = await this.walletService.getBalance(params.walletId, actor);
    return successResponse(data);
  }

  @Get(':walletId/transactions')
  @Permissions(PERMISSION_WALLETS_READ)
  async getTransactions(
    @Param() params: WalletIdParamDto,
    @CurrentUser() actor: JwtAccessClaims,
    @Query() query: PaginationQueryDto,
  ) {
    const data = await this.walletService.getTransactions(
      params.walletId,
      actor,
      query.skip ?? 0,
      query.take ?? 50,
    );
    return successResponse(data);
  }
}
