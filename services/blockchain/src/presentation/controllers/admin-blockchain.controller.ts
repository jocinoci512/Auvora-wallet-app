import { Body, Controller, Get, Inject, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiTags } from '@nestjs/swagger';
import { AdminMetricsService } from '../../application/services/admin-metrics.service';
import { AdminQueryService } from '../../application/services/admin-query.service';
import { ProviderRpcHealthService } from '../../application/services/provider-rpc-health.service';
import { SyncService } from '../../application/services/sync.service';
import { TransactionEngine } from '../../application/services/transaction-engine.service';
import {
  PERMISSION_BLOCKCHAIN_ADMIN,
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
import { AdminListTransactionsQueryDto } from '../dto/transaction.dto';

// Keep DTO classes as runtime values for Nest ValidationPipe + Swagger.
const _adminBlockchainDtoRuntime = {
  AdminListBlocksQueryDto,
  AdminListEventsQueryDto,
  AdminListHealthQueryDto,
  AdminListSyncJobsQueryDto,
  TriggerSyncDto,
  AdminListTransactionsQueryDto,
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
  ) {}

  @Get('providers')
  @Permissions(PERMISSION_BLOCKCHAIN_ADMIN)
  async listProviders() {
    const data = await this.queryService.listProviders();
    return successResponse(data);
  }

  @Get('health')
  @Permissions(PERMISSION_BLOCKCHAIN_ADMIN)
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
  @Permissions(PERMISSION_BLOCKCHAIN_ADMIN)
  async listLiveRpcHealth() {
    const providers = await this.providerRpcHealth.getAll();
    const sync = this.syncService.getSyncPolicy();
    return successResponse({ sync, providers });
  }

  @Get('sync-jobs')
  @Permissions(PERMISSION_BLOCKCHAIN_SYNC)
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
  @Permissions(PERMISSION_BLOCKCHAIN_ADMIN)
  async listBlocks(@Query() query: AdminListBlocksQueryDto) {
    const data = await this.queryService.listBlocks({
      chain: query.chain,
      skip: query.skip ?? 0,
      take: query.take ?? 50,
    });
    return successResponse(data);
  }

  @Get('transactions')
  @Permissions(PERMISSION_BLOCKCHAIN_ADMIN)
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
  @Permissions(PERMISSION_BLOCKCHAIN_ADMIN)
  async getMetrics() {
    const data = await this.metricsService.getMetrics();
    return successResponse(data);
  }

  @Get('events')
  @Permissions(PERMISSION_BLOCKCHAIN_ADMIN)
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
