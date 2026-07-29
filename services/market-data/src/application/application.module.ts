import { Module } from '@nestjs/common';
import { InfrastructureModule } from '../infrastructure/infrastructure.module';
import { MarketDashboardService } from './services/market-dashboard.service';
import { MarketDataEngineService } from './services/market-data-engine.service';
import { MarketWorkersService } from './services/market-workers.service';
import { PortfolioIntelligenceService } from './services/portfolio-intelligence.service';
import { PriceAlertService } from './services/price-alert.service';
import { PriceHistoryService } from './services/price-history.service';
import { TokenMetadataService } from './services/token-metadata.service';
import { WatchlistService } from './services/watchlist.service';

@Module({
  imports: [InfrastructureModule],
  providers: [
    MarketDataEngineService,
    TokenMetadataService,
    PriceHistoryService,
    PortfolioIntelligenceService,
    WatchlistService,
    PriceAlertService,
    MarketDashboardService,
    MarketWorkersService,
  ],
  exports: [
    MarketDataEngineService,
    TokenMetadataService,
    PriceHistoryService,
    PortfolioIntelligenceService,
    WatchlistService,
    PriceAlertService,
    MarketDashboardService,
    MarketWorkersService,
  ],
})
export class ApplicationModule {}
