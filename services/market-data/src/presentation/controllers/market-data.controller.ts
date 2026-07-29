import { Body, Controller, Get, Inject, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { JwtAccessClaims } from '@auvora/types';
import { Allow, IsArray, IsIn, IsOptional, IsString, MinLength } from 'class-validator';
import { MarketDashboardService } from '../../application/services/market-dashboard.service';
import { MarketDataEngineService } from '../../application/services/market-data-engine.service';
import {
  PriceHistoryService,
  type ChartRange,
} from '../../application/services/price-history.service';
import { TokenMetadataService } from '../../application/services/token-metadata.service';
import type { HoldingInput } from '../../application/services/portfolio-intelligence.service';
import type { SupportedMarketNetwork } from '../../domain/market-provider.port';
import { PERMISSION_MARKET_DATA_READ } from '../../domain/permission-codes';
import { successResponse } from '@auvora/nest-common';
import { Permissions } from '../decorators/auth.decorators';
import { CurrentUser } from '../decorators/current-user.decorator';

class QuoteQueryDto {
  @IsString()
  @MinLength(1)
  symbol!: string;

  @IsString()
  @IsIn(['ETHEREUM', 'BNB_SMART_CHAIN', 'SOLANA', 'TRON', 'BITCOIN'])
  network!: SupportedMarketNetwork;
}

class ChartQueryDto extends QuoteQueryDto {
  @IsOptional()
  @IsIn(['1d', '7d', '30d', '90d', '1y', 'all'])
  range?: ChartRange;
}

class HoldingsBodyDto {
  @IsArray()
  @Allow()
  holdings!: HoldingInput[];
}

@ApiTags('market-data')
@ApiBearerAuth()
@Controller('api/v1/market-data')
export class MarketDataController {
  constructor(
    @Inject(MarketDataEngineService) private readonly engine: MarketDataEngineService,
    @Inject(TokenMetadataService) private readonly metadata: TokenMetadataService,
    @Inject(PriceHistoryService) private readonly history: PriceHistoryService,
    @Inject(MarketDashboardService) private readonly dashboards: MarketDashboardService,
  ) {}

  @Get('prices')
  @Permissions(PERMISSION_MARKET_DATA_READ)
  async prices(@Query() query: QuoteQueryDto) {
    return successResponse(await this.engine.getQuote(query.symbol, query.network));
  }

  @Get('trending')
  @Permissions(PERMISSION_MARKET_DATA_READ)
  async trending() {
    return successResponse(await this.engine.getTrending());
  }

  @Get('overview')
  @Permissions(PERMISSION_MARKET_DATA_READ)
  async overview() {
    return successResponse(await this.engine.getMarketOverview());
  }

  @Get('metadata')
  @Permissions(PERMISSION_MARKET_DATA_READ)
  async metadataFor(@Query() query: QuoteQueryDto) {
    return successResponse(await this.metadata.getMetadata(query.symbol, query.network));
  }

  @Get('charts')
  @Permissions(PERMISSION_MARKET_DATA_READ)
  async charts(@Query() query: ChartQueryDto) {
    return successResponse(
      await this.history.getChart(query.symbol, query.network, query.range ?? '7d'),
    );
  }

  @Get('observability')
  @Permissions(PERMISSION_MARKET_DATA_READ)
  observability() {
    return successResponse(this.engine.getObservabilitySnapshot());
  }

  @Get('dashboards/market-overview')
  @Permissions(PERMISSION_MARKET_DATA_READ)
  async marketOverviewDashboard() {
    return successResponse(await this.dashboards.marketOverview());
  }

  @Get('dashboards/top-movers')
  @Permissions(PERMISSION_MARKET_DATA_READ)
  async topMovers() {
    return successResponse(await this.dashboards.topMovers());
  }

  @Get('dashboards/trending')
  @Permissions(PERMISSION_MARKET_DATA_READ)
  async trendingDashboard() {
    return successResponse(await this.dashboards.trendingAssets());
  }

  @Post('dashboards/portfolio-overview')
  @Permissions(PERMISSION_MARKET_DATA_READ)
  async portfolioOverview(@CurrentUser() user: JwtAccessClaims, @Body() body: HoldingsBodyDto) {
    return successResponse(await this.dashboards.portfolioOverview(user.sub, body.holdings ?? []));
  }

  @Post('dashboards/asset-allocation')
  @Permissions(PERMISSION_MARKET_DATA_READ)
  async assetAllocation(@CurrentUser() user: JwtAccessClaims, @Body() body: HoldingsBodyDto) {
    return successResponse(await this.dashboards.assetAllocation(user.sub, body.holdings ?? []));
  }

  @Post('dashboards/performance')
  @Permissions(PERMISSION_MARKET_DATA_READ)
  async performance(@CurrentUser() user: JwtAccessClaims, @Body() body: HoldingsBodyDto) {
    return successResponse(await this.dashboards.performance(user.sub, body.holdings ?? []));
  }

  @Post('dashboards/network-breakdown')
  @Permissions(PERMISSION_MARKET_DATA_READ)
  async networkBreakdown(@CurrentUser() user: JwtAccessClaims, @Body() body: HoldingsBodyDto) {
    return successResponse(await this.dashboards.networkBreakdown(user.sub, body.holdings ?? []));
  }

  @Get('networks/:network/symbols/:symbol')
  @Permissions(PERMISSION_MARKET_DATA_READ)
  async byPath(@Param('network') network: SupportedMarketNetwork, @Param('symbol') symbol: string) {
    return successResponse(await this.engine.getQuote(symbol, network));
  }
}
