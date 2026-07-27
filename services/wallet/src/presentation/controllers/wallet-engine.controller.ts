import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiTags } from '@nestjs/swagger';
import { IsBoolean, IsInt, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';
import type { JwtAccessClaims } from '@auvora/types';
import { PortfolioEngineService } from '../../application/services/portfolio-engine.service';
import { WalletEngineService } from '../../application/services/wallet-engine.service';
import { WalletSyncService } from '../../application/services/wallet-sync.service';
import { WalletWorkersService } from '../../application/services/wallet-workers.service';
import {
  PERMISSION_WALLETS_READ,
  PERMISSION_WALLETS_WRITE,
} from '../../domain/permission-codes';
import { Permissions } from '../decorators/auth.decorators';
import { CurrentUser } from '../decorators/current-user.decorator';
import { successResponse } from '../common/api-response';
import { WalletIdParamDto } from '../dto/wallet.dto';

class EngineCreateWalletDto {
  @IsString()
  assetCode!: string;

  @IsOptional()
  @IsString()
  alias?: string;

  @IsOptional()
  @IsString()
  label?: string;

  @IsOptional()
  @IsBoolean()
  provisionAddress?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  accountIndex?: number;
}

class ImportAddressDto {
  @IsString()
  assetCode!: string;

  @IsString()
  address!: string;

  @IsOptional()
  @IsString()
  alias?: string;

  @IsOptional()
  @IsString()
  label?: string;
}

class ValidateAddressDto {
  @IsString()
  chain!: string;

  @IsString()
  address!: string;
}

class SwitchNetworkDto {
  @IsString()
  network!: string;
}

class SwitchAccountDto {
  @IsInt()
  @Min(0)
  @Max(100)
  accountIndex!: number;
}

class DiscoverAccountsDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10)
  count?: number;
}

class PortfolioQueryDto {
  @IsOptional()
  @IsUUID()
  userId?: string;
}

void EngineCreateWalletDto;
void ImportAddressDto;
void ValidateAddressDto;
void SwitchNetworkDto;
void SwitchAccountDto;
void DiscoverAccountsDto;
void PortfolioQueryDto;
void WalletIdParamDto;

@ApiTags('wallet-engine')
@ApiBearerAuth()
@Controller('api/v1/wallet-engine')
export class WalletEngineController {
  constructor(
    @Inject(WalletEngineService) private readonly engine: WalletEngineService,
    @Inject(PortfolioEngineService) private readonly portfolio: PortfolioEngineService,
    @Inject(WalletSyncService) private readonly syncService: WalletSyncService,
    @Inject(WalletWorkersService) private readonly workers: WalletWorkersService,
  ) {}

  @Post('wallets')
  @Permissions(PERMISSION_WALLETS_WRITE)
  @ApiBody({ type: EngineCreateWalletDto })
  async create(@CurrentUser() user: JwtAccessClaims, @Body() dto: EngineCreateWalletDto) {
    const data = await this.engine.createWallet({
      ownerUserId: user.sub,
      assetCode: dto.assetCode,
      alias: dto.alias,
      label: dto.label,
      provisionAddress: dto.provisionAddress,
      accountIndex: dto.accountIndex,
    });
    return successResponse(data);
  }

  @Post('wallets/import')
  @Permissions(PERMISSION_WALLETS_WRITE)
  @ApiBody({ type: ImportAddressDto })
  async importAddress(@CurrentUser() user: JwtAccessClaims, @Body() dto: ImportAddressDto) {
    const data = await this.engine.importPublicAddress(
      {
        ownerUserId: user.sub,
        assetCode: dto.assetCode,
        address: dto.address,
        alias: dto.alias,
        label: dto.label,
      },
      user,
    );
    return successResponse(data);
  }

  @Post('addresses/validate')
  @Permissions(PERMISSION_WALLETS_READ)
  @ApiBody({ type: ValidateAddressDto })
  async validate(@Body() dto: ValidateAddressDto) {
    const valid = await this.engine.validateAddress(dto.chain, dto.address);
    return successResponse({ chain: dto.chain, address: dto.address, valid });
  }

  @Get('networks')
  @Permissions(PERMISSION_WALLETS_READ)
  async networks() {
    const data = await this.engine.getSupportedNetworks();
    return successResponse({ networks: data });
  }

  @Get('portfolio')
  @Permissions(PERMISSION_WALLETS_READ)
  async portfolioForUser(@CurrentUser() user: JwtAccessClaims, @Query() query: PortfolioQueryDto) {
    const data = await this.portfolio.getPortfolioForUser(query.userId ?? user.sub, user);
    return successResponse(data);
  }

  @Get('workers/health')
  @Permissions(PERMISSION_WALLETS_READ)
  workersHealth() {
    return successResponse({ workers: this.workers.getWorkerHealth() });
  }

  @Post('wallets/:walletId/restore')
  @Permissions(PERMISSION_WALLETS_WRITE)
  async restore(@CurrentUser() user: JwtAccessClaims, @Param() params: WalletIdParamDto) {
    const data = await this.engine.restoreWallet(params.walletId, user);
    return successResponse(data);
  }

  @Get('wallets/:walletId/export')
  @Permissions(PERMISSION_WALLETS_READ)
  async export(@CurrentUser() user: JwtAccessClaims, @Param() params: WalletIdParamDto) {
    const data = await this.engine.exportWallet(params.walletId, user);
    return successResponse(data);
  }

  @Post('wallets/:walletId/addresses/generate')
  @Permissions(PERMISSION_WALLETS_WRITE)
  async generateAddress(@CurrentUser() user: JwtAccessClaims, @Param() params: WalletIdParamDto) {
    const data = await this.engine.generateAddress(params.walletId, user);
    return successResponse(data);
  }

  @Post('wallets/:walletId/network')
  @Permissions(PERMISSION_WALLETS_WRITE)
  @ApiBody({ type: SwitchNetworkDto })
  async switchNetwork(
    @CurrentUser() user: JwtAccessClaims,
    @Param() params: WalletIdParamDto,
    @Body() dto: SwitchNetworkDto,
  ) {
    const data = await this.engine.switchNetwork(params.walletId, dto.network, user);
    return successResponse(data);
  }

  @Post('wallets/:walletId/accounts/switch')
  @Permissions(PERMISSION_WALLETS_WRITE)
  @ApiBody({ type: SwitchAccountDto })
  async switchAccount(
    @CurrentUser() user: JwtAccessClaims,
    @Param() params: WalletIdParamDto,
    @Body() dto: SwitchAccountDto,
  ) {
    const data = await this.engine.switchAccount(params.walletId, dto.accountIndex, user);
    return successResponse(data);
  }

  @Get('wallets/:walletId/accounts')
  @Permissions(PERMISSION_WALLETS_READ)
  async listAccounts(@CurrentUser() user: JwtAccessClaims, @Param() params: WalletIdParamDto) {
    const data = await this.engine.listAccounts(params.walletId, user);
    return successResponse({ accounts: data });
  }

  @Post('wallets/:walletId/accounts/discover')
  @Permissions(PERMISSION_WALLETS_WRITE)
  @ApiBody({ type: DiscoverAccountsDto })
  async discover(
    @CurrentUser() user: JwtAccessClaims,
    @Param() params: WalletIdParamDto,
    @Body() dto: DiscoverAccountsDto,
  ) {
    const data = await this.engine.discoverAccounts(params.walletId, user, dto.count);
    return successResponse({ accounts: data });
  }

  @Post('wallets/:walletId/sync')
  @Permissions(PERMISSION_WALLETS_WRITE)
  async syncWallet(@CurrentUser() user: JwtAccessClaims, @Param() params: WalletIdParamDto) {
    const wallet = await this.engine.requireWallet(params.walletId, user);
    const data = await this.syncService.syncWallet(wallet);
    return successResponse(data);
  }

  @Post('wallets/:walletId/recovery/verify')
  @Permissions(PERMISSION_WALLETS_WRITE)
  async verifyRecovery(@CurrentUser() user: JwtAccessClaims, @Param() params: WalletIdParamDto) {
    const data = await this.engine.verifyRecovery(params.walletId, user);
    return successResponse(data);
  }

  @Get('wallets/:walletId/summary')
  @Permissions(PERMISSION_WALLETS_READ)
  async summary(@CurrentUser() user: JwtAccessClaims, @Param() params: WalletIdParamDto) {
    const data = await this.portfolio.getWalletSummary(params.walletId, user);
    return successResponse(data);
  }
}
