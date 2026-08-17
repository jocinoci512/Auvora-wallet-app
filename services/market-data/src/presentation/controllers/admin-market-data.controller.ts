import { Controller, Get, Inject, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { MarketDataEngineService } from '../../application/services/market-data-engine.service';
import { MarketWorkersService } from '../../application/services/market-workers.service';
import { PriceAlertService } from '../../application/services/price-alert.service';
import { PriceHistoryService } from '../../application/services/price-history.service';
import { TokenMetadataService } from '../../application/services/token-metadata.service';
import { PERMISSION_MARKET_DATA_ADMIN, ADMIN_PORTAL_ROLES } from '../../domain/permission-codes';
import { successResponse } from '@auvora/nest-common';
import { Permissions, Roles } from '../decorators/auth.decorators';

@ApiTags('admin-market-data')
@ApiBearerAuth()
@Controller('api/v1/admin/market-data')
@Roles(...ADMIN_PORTAL_ROLES)
export class AdminMarketDataController {
  constructor(
    @Inject(MarketDataEngineService) private readonly engine: MarketDataEngineService,
    @Inject(TokenMetadataService) private readonly metadata: TokenMetadataService,
    @Inject(PriceHistoryService) private readonly history: PriceHistoryService,
    @Inject(PriceAlertService) private readonly alerts: PriceAlertService,
    @Inject(MarketWorkersService) private readonly workers: MarketWorkersService,
  ) {}

  @Get('providers')
  @Permissions(PERMISSION_MARKET_DATA_ADMIN)
  providers() {
    return successResponse({
      ...this.engine.getObservabilitySnapshot(),
      workers: this.workers.status(),
    });
  }

  @Post('sync/prices')
  @Permissions(PERMISSION_MARKET_DATA_ADMIN)
  async syncPrices() {
    return successResponse({ refreshed: await this.engine.refreshAllNativePrices() });
  }

  @Post('sync/metadata')
  @Permissions(PERMISSION_MARKET_DATA_ADMIN)
  async syncMetadata() {
    return successResponse({ synced: await this.metadata.syncNativeMetadata() });
  }

  @Post('sync/history')
  @Permissions(PERMISSION_MARKET_DATA_ADMIN)
  async syncHistory() {
    return successResponse({ synced: await this.history.syncHistoryForNatives() });
  }

  @Post('alerts/evaluate')
  @Permissions(PERMISSION_MARKET_DATA_ADMIN)
  async evaluateAlerts() {
    return successResponse({ triggered: await this.alerts.evaluateActive() });
  }
}
