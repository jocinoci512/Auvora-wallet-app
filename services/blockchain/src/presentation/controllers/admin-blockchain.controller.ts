import { Body, Controller, Get, Inject, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiTags } from '@nestjs/swagger';
import { AdminMetricsService } from '../../application/services/admin-metrics.service';
import { AdminQueryService } from '../../application/services/admin-query.service';
import { BlockchainService } from '../../application/services/blockchain.service';
import { getMainnetRolloutSummary } from '../../application/services/broadcast-policy';
import { ProviderRpcHealthService } from '../../application/services/provider-rpc-health.service';
import { SyncService } from '../../application/services/sync.service';
import { TransactionEngine } from '../../application/services/transaction-engine.service';
import { ENV, type ServiceEnv } from '../../config/env.schema';
import { MAINNET_CHAIN_CONFIRMATION_POLICIES } from '../../domain/mainnet-rollout';
import {
  PERMISSION_BLOCKCHAIN_READ,
  PERMISSION_BLOCKCHAIN_SYNC,
  ADMIN_PORTAL_ROLES,
} from '../../domain/permission-codes';
import { successResponse } from '@auvora/nest-common';
import { Permissions, Roles } from '../decorators/auth.decorators';
import {
  AdminListBlocksQueryDto,
  AdminListEventsQueryDto,
  AdminListHealthQueryDto,
  AdminListSyncJobsQueryDto,
  TriggerSyncDto,
} from '../dto/admin.dto';
import { AdminListAddressesQueryDto } from '../dto/address.dto';
import { AdminListTransactionsQueryDto } from '../dto/transaction.dto';

// Keep DTO classes as runtime values for Nest ValidationPipe + Swagger.
const _adminBlockchainDtoRuntime = {
  AdminListBlocksQueryDto,
  AdminListEventsQueryDto,
  AdminListHealthQueryDto,
  AdminListSyncJobsQueryDto,
  TriggerSyncDto,
  AdminListTransactionsQueryDto,
  AdminListAddressesQueryDto,
};
void _adminBlockchainDtoRuntime;

@ApiTags('admin-blockchain')
@ApiBearerAuth()
@Controller('api/v1/admin/blockchain')
@Roles(...ADMIN_PORTAL_ROLES)
export class AdminBlockchainController {
  constructor(
    @Inject(TransactionEngine) private readonly transactionEngine: TransactionEngine,
    @Inject(SyncService) private readonly syncService: SyncService,
    @Inject(AdminMetricsService) private readonly metricsService: AdminMetricsService,
    @Inject(AdminQueryService) private readonly queryService: AdminQueryService,
    @Inject(ProviderRpcHealthService) private readonly providerRpcHealth: ProviderRpcHealthService,
    @Inject(BlockchainService) private readonly blockchainService: BlockchainService,
    @Inject(ENV) private readonly env: ServiceEnv,
  ) {}

  @Get('addresses')
  @Permissions(PERMISSION_BLOCKCHAIN_READ)
  async listAddresses(@Query() query: AdminListAddressesQueryDto) {
    const data = await this.blockchainService.adminListAddresses({
      ownerUserId: query.ownerUserId,
      chain: query.chain,
      status: query.status,
      skip: query.skip ?? 0,
      take: query.take ?? 50,
    });
    return successResponse(data);
  }

  /**
   * Safe, read-only Mainnet readiness, rollouts, and kill-switch posture.
   * Admin can display this dashboard, but CANNOT toggle Mainnet, sign, or broadcast.
   */
  @Get('mainnet/readiness')
  @Permissions(PERMISSION_BLOCKCHAIN_READ)
  getMainnetReadiness() {
    const summary = getMainnetRolloutSummary(this.env);
    return successResponse({
      ...summary,
      chainPolicies: MAINNET_CHAIN_CONFIRMATION_POLICIES,
    });
  }

  @Get('providers')
  @Permissions(PERMISSION_BLOCKCHAIN_READ)
  async listProviders() {
    const data = await this.queryService.listProviders();
    return successResponse(data);
  }

  @Get('health')
  @Permissions(PERMISSION_BLOCKCHAIN_READ)
  async listHealth(@Query() query: AdminListHealthQueryDto) {
    const data = await this.queryService.listHealth({
      chain: query.chain,
      skip: query.skip ?? 0,
      take: query.take ?? 50,
    });
    return successResponse(data);
  }

  /** Live RPC probe summary (Alchemy vs simulator) for every registered chain. */
  @Get('providers/rpc-health')
  @Permissions(PERMISSION_BLOCKCHAIN_READ)
  async listLiveRpcHealth() {
    const providers = await this.providerRpcHealth.getAll();
    const sync = this.syncService.getSyncPolicy();
    return successResponse({ sync, providers });
  }

  @Get('sync-jobs')
  @Permissions(PERMISSION_BLOCKCHAIN_READ)
  async listSyncJobs(@Query() query: AdminListSyncJobsQueryDto) {
    const data = await this.queryService.listSyncJobs({
      chain: query.chain,
      status: query.status,
      type: query.type,
      skip: query.skip ?? 0,
      take: query.take ?? 50,
    });
    return successResponse(data);
  }

  @Post('sync-jobs')
  @Permissions(PERMISSION_BLOCKCHAIN_SYNC)
  @ApiBody({ type: TriggerSyncDto })
  async triggerSync(@Body() dto: TriggerSyncDto) {
    const data = await this.syncService.triggerManualSync(dto.chain);
    return successResponse(data);
  }

  @Get('blocks')
  @Permissions(PERMISSION_BLOCKCHAIN_READ)
  async listBlocks(@Query() query: AdminListBlocksQueryDto) {
    const data = await this.queryService.listBlocks({
      chain: query.chain,
      skip: query.skip ?? 0,
      take: query.take ?? 50,
    });
    return successResponse(data);
  }

  @Get('transactions')
  @Permissions(PERMISSION_BLOCKCHAIN_READ)
  async listTransactions(@Query() query: AdminListTransactionsQueryDto) {
    const data = await this.transactionEngine.listTransactions({
      chain: query.chain,
      status: query.status,
      ownerUserId: query.ownerUserId,
      skip: query.skip ?? 0,
      take: query.take ?? 50,
    });
    return successResponse(data);
  }

  @Get('metrics')
  @Permissions(PERMISSION_BLOCKCHAIN_READ)
  async getMetrics() {
    const data = await this.metricsService.getMetrics();
    return successResponse(data);
  }

  @Get('events')
  @Permissions(PERMISSION_BLOCKCHAIN_READ)
  async listEvents(@Query() query: AdminListEventsQueryDto) {
    const data = await this.queryService.listEvents({
      chain: query.chain,
      eventType: query.eventType,
      skip: query.skip ?? 0,
      take: query.take ?? 50,
    });
    return successResponse(data);
  }
}
