import { Body, Controller, Get, Inject, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiTags } from '@nestjs/swagger';
import type { JwtAccessClaims } from '@auvora/types';
import { WalletService } from '../../application/services/wallet.service';
import { PERMISSION_WALLETS_READ, PERMISSION_WALLETS_WRITE } from '../../domain/permission-codes';
import { Permissions } from '../decorators/auth.decorators';
import { CurrentUser } from '../decorators/current-user.decorator';
import { successResponse } from '@auvora/nest-common';
import {
  CreateWalletDto,
  ListUserWalletsQueryDto,
  PaginationQueryDto,
  SnapshotBalanceDto,
  StatusChangeDto,
  UpdateWalletDto,
  WalletIdParamDto,
} from '../dto/wallet.dto';

// Keep DTO classes as runtime values for Nest ValidationPipe + Swagger.
const _walletDtoRuntime = {
  CreateWalletDto,
  ListUserWalletsQueryDto,
  PaginationQueryDto,
  SnapshotBalanceDto,
  StatusChangeDto,
  UpdateWalletDto,
  WalletIdParamDto,
};
void _walletDtoRuntime;

@ApiTags('wallets')
@ApiBearerAuth()
@Controller('api/v1/wallets')
export class WalletsController {
  constructor(@Inject(WalletService) private readonly walletService: WalletService) {}

  @Post()
  @Permissions(PERMISSION_WALLETS_WRITE)
  @ApiBody({ type: CreateWalletDto })
  async create(@CurrentUser() user: JwtAccessClaims, @Body() dto: CreateWalletDto) {
    const data = await this.walletService.createWallet({
      ownerUserId: user.sub,
      assetCode: dto.assetCode,
      alias: dto.alias,
      label: dto.label,
      metadata: dto.metadata,
      preferences: dto.preferences,
    });
    return successResponse(data);
  }

  @Get()
  @Permissions(PERMISSION_WALLETS_READ)
  async list(@CurrentUser() user: JwtAccessClaims, @Query() query: ListUserWalletsQueryDto) {
    const data = await this.walletService.listWalletsForUser(
      query.userId ?? user.sub,
      user,
      query.skip ?? 0,
      query.take ?? 50,
    );
    return successResponse(data);
  }

  @Get(':walletId')
  @Permissions(PERMISSION_WALLETS_READ)
  async get(@CurrentUser() user: JwtAccessClaims, @Param() params: WalletIdParamDto) {
    const data = await this.walletService.getWallet(params.walletId, user);
    return successResponse(data);
  }

  @Patch(':walletId')
  @Permissions(PERMISSION_WALLETS_WRITE)
  async update(
    @CurrentUser() user: JwtAccessClaims,
    @Param() params: WalletIdParamDto,
    @Body() dto: UpdateWalletDto,
  ) {
    const data = await this.walletService.updateWallet(params.walletId, dto, user);
    return successResponse(data);
  }

  @Post(':walletId/activate')
  @Permissions(PERMISSION_WALLETS_WRITE)
  async activate(
    @CurrentUser() user: JwtAccessClaims,
    @Param() params: WalletIdParamDto,
    @Body() dto: StatusChangeDto,
  ) {
    const data = await this.walletService.activate(params.walletId, user, dto.reason);
    return successResponse(data);
  }

  @Post(':walletId/suspend')
  @Permissions(PERMISSION_WALLETS_WRITE)
  async suspend(
    @CurrentUser() user: JwtAccessClaims,
    @Param() params: WalletIdParamDto,
    @Body() dto: StatusChangeDto,
  ) {
    const data = await this.walletService.suspend(params.walletId, user, dto.reason);
    return successResponse(data);
  }

  @Post(':walletId/archive')
  @Permissions(PERMISSION_WALLETS_WRITE)
  async archive(
    @CurrentUser() user: JwtAccessClaims,
    @Param() params: WalletIdParamDto,
    @Body() dto: StatusChangeDto,
  ) {
    const data = await this.walletService.archive(params.walletId, user, dto.reason);
    return successResponse(data);
  }

  @Post(':walletId/restore')
  @Permissions(PERMISSION_WALLETS_WRITE)
  async restore(
    @CurrentUser() user: JwtAccessClaims,
    @Param() params: WalletIdParamDto,
    @Body() dto: StatusChangeDto,
  ) {
    const data = await this.walletService.restore(params.walletId, user, dto.reason);
    return successResponse(data);
  }

  @Get(':walletId/balance')
  @Permissions(PERMISSION_WALLETS_READ)
  async getBalance(@CurrentUser() user: JwtAccessClaims, @Param() params: WalletIdParamDto) {
    const data = await this.walletService.getBalance(params.walletId, user);
    return successResponse(data);
  }

  @Get(':walletId/transactions')
  @Permissions(PERMISSION_WALLETS_READ)
  async getTransactions(
    @CurrentUser() user: JwtAccessClaims,
    @Param() params: WalletIdParamDto,
    @Query() query: PaginationQueryDto,
  ) {
    const data = await this.walletService.getTransactions(
      params.walletId,
      user,
      query.skip ?? 0,
      query.take ?? 50,
    );
    return successResponse(data);
  }

  @Post(':walletId/snapshot')
  @Permissions(PERMISSION_WALLETS_WRITE)
  async snapshotBalance(
    @CurrentUser() user: JwtAccessClaims,
    @Param() params: WalletIdParamDto,
    @Body() dto: SnapshotBalanceDto,
  ) {
    const data = await this.walletService.snapshotBalance(params.walletId, user, dto.reason);
    return successResponse(data);
  }

  @Get(':walletId/balance-history')
  @Permissions(PERMISSION_WALLETS_READ)
  async getBalanceHistory(
    @CurrentUser() user: JwtAccessClaims,
    @Param() params: WalletIdParamDto,
    @Query() query: PaginationQueryDto,
  ) {
    const data = await this.walletService.getBalanceHistory(
      params.walletId,
      user,
      query.skip ?? 0,
      query.take ?? 50,
    );
    return successResponse(data);
  }

  @Get(':walletId/balance-audits')
  @Permissions(PERMISSION_WALLETS_READ)
  async getBalanceAudits(
    @CurrentUser() user: JwtAccessClaims,
    @Param() params: WalletIdParamDto,
    @Query() query: PaginationQueryDto,
  ) {
    const data = await this.walletService.getBalanceAudits(
      params.walletId,
      user,
      query.skip ?? 0,
      query.take ?? 50,
    );
    return successResponse(data);
  }

  @Get(':walletId/status-history')
  @Permissions(PERMISSION_WALLETS_READ)
  async getStatusHistory(
    @CurrentUser() user: JwtAccessClaims,
    @Param() params: WalletIdParamDto,
    @Query() query: PaginationQueryDto,
  ) {
    const data = await this.walletService.getStatusHistory(
      params.walletId,
      user,
      query.skip ?? 0,
      query.take ?? 50,
    );
    return successResponse(data);
  }
}
