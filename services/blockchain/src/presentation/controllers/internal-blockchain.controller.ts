import { Body, Controller, Get, Inject, Param, Post, UseGuards } from '@nestjs/common';
import { ApiExcludeController, ApiTags } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';
import { ChainNetwork } from '@auvora/database';
import { BlockchainService } from '../../application/services/blockchain.service';
import { SyncService } from '../../application/services/sync.service';
import { successResponse } from '../common/api-response';
import { Public, SkipCsrf } from '../decorators/auth.decorators';
import { InternalApiKeyGuard } from '../guards/internal-api-key.guard';

class InternalCreateAddressDto {
  @IsEnum(ChainNetwork)
  chain!: ChainNetwork;

  @IsUUID()
  ownerUserId!: string;

  @IsOptional()
  @IsUUID()
  walletId?: string;

  @IsOptional()
  @IsString()
  label?: string;
}

class InternalValidateAddressDto {
  @IsEnum(ChainNetwork)
  chain!: ChainNetwork;

  @IsString()
  @IsNotEmpty()
  address!: string;
}

class InternalChainParamDto {
  @IsEnum(ChainNetwork)
  chain!: ChainNetwork;
}

class InternalBalanceParamsDto {
  @IsEnum(ChainNetwork)
  chain!: ChainNetwork;

  @IsString()
  @IsNotEmpty()
  address!: string;
}

class InternalTriggerSyncDto {
  @IsEnum(ChainNetwork)
  chain!: ChainNetwork;
}

void InternalCreateAddressDto;
void InternalValidateAddressDto;
void InternalChainParamDto;
void InternalBalanceParamsDto;
void InternalTriggerSyncDto;

/**
 * Service-to-service blockchain operations for Wallet Core (Phase 18).
 * Authenticated solely via `x-internal-api-key` — never expose via gateway.
 */
@ApiTags('internal-blockchain')
@ApiExcludeController()
@Public()
@SkipCsrf()
@UseGuards(InternalApiKeyGuard)
@Controller('api/v1/internal/blockchain')
export class InternalBlockchainController {
  constructor(
    @Inject(BlockchainService) private readonly blockchainService: BlockchainService,
    @Inject(SyncService) private readonly syncService: SyncService,
  ) {}

  @Post('addresses')
  async createAddress(
    @Body() dto: InternalCreateAddressDto,
  ): Promise<ReturnType<typeof successResponse>> {
    const data = await this.blockchainService.createAddress({
      ownerUserId: dto.ownerUserId,
      chain: dto.chain,
      walletId: dto.walletId,
      label: dto.label,
    });
    return successResponse(data);
  }

  @Post('addresses/validate')
  validateAddress(@Body() dto: InternalValidateAddressDto): ReturnType<typeof successResponse> {
    const valid = this.blockchainService.validateAddress(dto.chain, dto.address);
    return successResponse({
      chain: String(dto.chain),
      address: dto.address,
      valid,
    });
  }

  @Get('balances/:chain/:address')
  async getBalance(
    @Param() params: InternalBalanceParamsDto,
  ): Promise<ReturnType<typeof successResponse>> {
    const data = await this.blockchainService.getBalance(params.chain, params.address);
    return successResponse({
      chain: String(data.chain),
      address: data.address,
      balance: data.balance,
    });
  }

  @Get('networks/:chain/status')
  async getNetworkStatus(
    @Param() params: InternalChainParamDto,
  ): Promise<ReturnType<typeof successResponse>> {
    const data = await this.blockchainService.getNetworkStats(params.chain);
    return successResponse({
      chain: String(params.chain),
      blockHeight: data.blockHeight,
      healthy: data.healthy,
      latencyMs: data.latencyMs,
    });
  }

  @Post('sync')
  async triggerSync(
    @Body() dto: InternalTriggerSyncDto,
  ): Promise<ReturnType<typeof successResponse>> {
    const data = await this.syncService.triggerManualSync(dto.chain);
    return successResponse({
      id: data.id,
      chain: String(data.chain),
      type: String(data.type),
      status: String(data.status),
    });
  }

  @Get('chains')
  listChains(): ReturnType<typeof successResponse> {
    return successResponse({
      chains: this.blockchainService.getSupportedChains().map(String),
    });
  }
}
