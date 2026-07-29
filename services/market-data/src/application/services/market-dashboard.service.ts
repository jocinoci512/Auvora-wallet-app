import { Inject, Injectable } from '@nestjs/common';
import { MarketDataEngineService } from './market-data-engine.service';
import { PortfolioIntelligenceService, type HoldingInput } from './portfolio-intelligence.service';
import type { SupportedMarketNetwork } from '../../domain/market-provider.port';

@Injectable()
export class MarketDashboardService {
  constructor(
    @Inject(MarketDataEngineService) private readonly market: MarketDataEngineService,
    @Inject(PortfolioIntelligenceService)
    private readonly portfolio: PortfolioIntelligenceService,
  ) {}

  async portfolioOverview(ownerUserId: string, holdings: HoldingInput[]) {
    return this.portfolio.valueHoldings(ownerUserId, holdings);
  }

  async assetAllocation(ownerUserId: string, holdings: HoldingInput[]) {
    const snap = await this.portfolio.valueHoldings(ownerUserId, holdings);
    return {
      generatedAt: snap.generatedAt,
      totalValueUsd: snap.totalValueUsd,
      tokenAllocation: snap.tokenAllocation,
      largestHoldings: snap.largestHoldings,
    };
  }

  async performance(ownerUserId: string, holdings: HoldingInput[]) {
    const snap = await this.portfolio.valueHoldings(ownerUserId, holdings);
    return {
      generatedAt: snap.generatedAt,
      totalValueUsd: snap.totalValueUsd,
      dailyGainLossUsd: snap.dailyGainLossUsd,
      weeklyGainLossUsd: snap.weeklyGainLossUsd,
      monthlyGainLossUsd: snap.monthlyGainLossUsd,
      unrealizedProfitLossUsd: snap.unrealizedProfitLossUsd,
      historicalValue: snap.historicalValue,
    };
  }

  async topMovers() {
    const trending = await this.market.getTrending();
    return {
      generatedAt: new Date().toISOString(),
      movers: [...trending].sort(
        (a, b) => Math.abs(Number(b.change24hPct)) - Math.abs(Number(a.change24hPct)),
      ),
    };
  }

  async trendingAssets() {
    return {
      generatedAt: new Date().toISOString(),
      trending: await this.market.getTrending(),
    };
  }

  async marketOverview() {
    return this.market.getMarketOverview();
  }

  async networkBreakdown(ownerUserId: string, holdings: HoldingInput[]) {
    const snap = await this.portfolio.valueHoldings(ownerUserId, holdings);
    return {
      generatedAt: snap.generatedAt,
      networkBreakdown: snap.networkBreakdown,
      totalValueUsd: snap.totalValueUsd,
    };
  }

  async quote(symbol: string, network: SupportedMarketNetwork) {
    return this.market.getQuote(symbol, network);
  }
}
