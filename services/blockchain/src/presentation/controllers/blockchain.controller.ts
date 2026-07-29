import { Body, Controller, Get, Inject, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiTags } from '@nestjs/swagger';
import type { ChainNetwork } from '@auvora/database';
import type { ApiResponse, JwtAccessClaims } from '@auvora/types';
import { BlockchainService } from '../../application/services/blockchain.service';
import { FeeEngine } from '../../application/services/fee-engine.service';
import { ProviderRpcHealthService } from '../../application/services/provider-rpc-health.service';
import { TransactionEngine } from '../../application/services/transaction-engine.service';
import {
  PERMISSION_BLOCKCHAIN_READ,
  PERMISSION_BLOCKCHAIN_WRITE,
} from '../../domain/permission-codes';
import { successResponse } from '@auvora/nest-common';
import { CurrentUser } from '../decorators/current-user.decorator';
import { Permissions } from '../decorators/auth.decorators';
import {
  AddressIdParamDto,
  ChainAddressParamsDto,
  ChainParamDto,
  CreateAddressDto,
  ListAddressesQueryDto,
  UpdateAddressDto,
  ValidateAddressDto,
} from '../dto/address.dto';
import { EstimateFeeDto } from '../dto/fee.dto';
import { ListTransactionsQueryDto, TxIdOrHashParamDto } from '../dto/transaction.dto';

// Keep DTO classes as runtime values for Nest ValidationPipe + Swagger.
const _blockchainDtoRuntime = {
  AddressIdParamDto,
  ChainAddressParamsDto,
  ChainParamDto,
  CreateAddressDto,
  ListAddressesQueryDto,
  UpdateAddressDto,
  ValidateAddressDto,
  EstimateFeeDto,
  ListTransactionsQueryDto,
  TxIdOrHashParamDto,
};
void _blockchainDtoRuntime;

@ApiTags('blockchain')
@ApiBearerAuth()
@Controller('api/v1/blockchain')
export class BlockchainController {
  constructor(
    @Inject(BlockchainService) private readonly blockchainService: BlockchainService,
    @Inject(TransactionEngine) private readonly transactionEngine: TransactionEngine,
    @Inject(FeeEngine) private readonly feeEngine: FeeEngine,
    @Inject(ProviderRpcHealthService) private readonly providerHealth: ProviderRpcHealthService,
  ) {}

  @Get('chains')
  @Permissions(PERMISSION_BLOCKCHAIN_READ)
  list(): ApiResponse<{ chains: ChainNetwork[] }> {
    return successResponse({ chains: this.blockchainService.getSupportedChains() });
  }

  @Get('providers/health')
  @Permissions(PERMISSION_BLOCKCHAIN_READ)
  async listProviderHealth() {
    const providers = await this.providerHealth.getAll();
    return successResponse({ providers });
  }

  @Get('providers/:chain/health')
  @Permissions(PERMISSION_BLOCKCHAIN_READ)
  async getProviderHealth(@Param() params: ChainParamDto) {
    const provider = await this.providerHealth.getOne(params.chain);
    return successResponse({ provider });
  }

  @Post('addresses')
  @Permissions(PERMISSION_BLOCKCHAIN_WRITE)
  @ApiBody({ type: CreateAddressDto })
  async createAddress(@CurrentUser() user: JwtAccessClaims, @Body() dto: CreateAddressDto) {
    const data = await this.blockchainService.createAddress({
      ownerUserId: user.sub,
      chain: dto.chain,
      walletId: dto.walletId,
      label: dto.label,
    });
    return successResponse(data);
  }

  @Get('addresses')
  @Permissions(PERMISSION_BLOCKCHAIN_READ)
  async listAddresses(@CurrentUser() user: JwtAccessClaims, @Query() query: ListAddressesQueryDto) {
    const data = await this.blockchainService.listAddressesForUser(user.sub, user, {
      chain: query.chain,
      status: query.status,
      skip: query.skip ?? 0,
      take: query.take ?? 50,
    });
    return successResponse(data);
  }

  @Post('addresses/validate')
  @Permissions(PERMISSION_BLOCKCHAIN_READ)
  @ApiBody({ type: ValidateAddressDto })
  validateAddress(
    @Body() dto: ValidateAddressDto,
  ): ApiResponse<{ chain: ChainNetwork; address: string; valid: boolean }> {
    const valid = this.blockchainService.validateAddress(dto.chain, dto.address);
    return successResponse({ chain: dto.chain, address: dto.address, valid });
  }

  @Get('addresses/:id')
  @Permissions(PERMISSION_BLOCKCHAIN_READ)
  async getAddress(@CurrentUser() user: JwtAccessClaims, @Param() params: AddressIdParamDto) {
    const data = await this.blockchainService.getAddress(params.id, user);
    return successResponse(data);
  }

  @Patch('addresses/:id')
  @Permissions(PERMISSION_BLOCKCHAIN_WRITE)
  @ApiBody({ type: UpdateAddressDto })
  async updateAddress(
    @CurrentUser() user: JwtAccessClaims,
    @Param() params: AddressIdParamDto,
    @Body() dto: UpdateAddressDto,
  ) {
    const data = await this.blockchainService.updateAddress(params.id, dto, user);
    return successResponse(data);
  }

  @Post('addresses/:id/activate')
  @Permissions(PERMISSION_BLOCKCHAIN_WRITE)
  async activateAddress(@CurrentUser() user: JwtAccessClaims, @Param() params: AddressIdParamDto) {
    const data = await this.blockchainService.activate(params.id, user);
    return successResponse(data);
  }

  @Post('addresses/:id/archive')
  @Permissions(PERMISSION_BLOCKCHAIN_WRITE)
  async archiveAddress(@CurrentUser() user: JwtAccessClaims, @Param() params: AddressIdParamDto) {
    const data = await this.blockchainService.archive(params.id, user);
    return successResponse(data);
  }

  @Post('addresses/:id/primary')
  @Permissions(PERMISSION_BLOCKCHAIN_WRITE)
  async setPrimaryAddress(
    @CurrentUser() user: JwtAccessClaims,
    @Param() params: AddressIdParamDto,
  ) {
    const data = await this.blockchainService.setPrimary(params.id, user);
    return successResponse(data);
  }

  @Get('balances/:chain/:address')
  @Permissions(PERMISSION_BLOCKCHAIN_READ)
  async getBalance(@Param() params: ChainAddressParamsDto) {
    const data = await this.blockchainService.getBalance(params.chain, params.address);
    return successResponse(data);
  }

  @Get('transactions')
  @Permissions(PERMISSION_BLOCKCHAIN_READ)
  async listTransactions(
    @CurrentUser() user: JwtAccessClaims,
    @Query() query: ListTransactionsQueryDto,
  ) {
    const data = await this.transactionEngine.listTransactions({
      chain: query.chain,
      status: query.status,
      ownerUserId: user.sub,
      skip: query.skip ?? 0,
      take: query.take ?? 50,
    });
    return successResponse(data);
  }

  @Get('transactions/:idOrHash')
  @Permissions(PERMISSION_BLOCKCHAIN_READ)
  async getTransaction(@Param() params: TxIdOrHashParamDto) {
    const data = await this.transactionEngine.getTransaction(params.idOrHash);
    return successResponse(data);
  }

  @Post('fees/estimate')
  @Permissions(PERMISSION_BLOCKCHAIN_READ)
  @ApiBody({ type: EstimateFeeDto })
  async estimateFee(@Body() dto: EstimateFeeDto) {
    const data = await this.feeEngine.estimateFee(dto.chain, dto.priority);
    return successResponse(data);
  }

  @Get('networks/:chain/status')
  @Permissions(PERMISSION_BLOCKCHAIN_READ)
  async getNetworkStatus(@Param() params: ChainParamDto) {
    const data = await this.blockchainService.getNetworkStats(params.chain);
    return successResponse(data);
  }
}
