import { Inject, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@auvora/database';
import { ENV, type ServiceEnv } from '../../config/env.schema';
import type { SupportedMarketNetwork } from '../../domain/market-provider.port';
import { pushLatency, withMarketSpan } from '../../domain/otel';
import { MarketProviderRegistry } from '../../infrastructure/providers/provider-registry';
import { REDIS_PORT, type RedisPort } from '../../infrastructure/redis/redis.port';
import { MarketDataEngineService } from './market-data-engine.service';

export type HoldingInput = {
  walletId?: string;
  assetCode: string;
  assetSymbol: string;
  assetChain: string;
  quantity: string;
  costBasisUsd?: string | null;
};

export type PortfolioIntelligenceSnapshot = {
  ownerUserId: string;
  generatedAt: string;
  totalValueUsd: string;
  dailyGainLossUsd: string;
  weeklyGainLossUsd: string;
  monthlyGainLossUsd: string;
  unrealizedProfitLossUsd: string;
  networkBreakdown: Array<{
    chain: string;
    valueUsd: string;
    allocationPct: string;
    walletCount: number;
  }>;
  tokenAllocation: Array<{
    assetCode: string;
    assetSymbol: string;
    quantity: string;
    priceUsd: string;
    valueUsd: string;
    allocationPct: string;
    change24hPct: string | null;
  }>;
  largestHoldings: Array<{
    assetSymbol: string;
    valueUsd: string;
    allocationPct: string;
  }>;
  historicalValue: Array<{ asOf: string; totalValueUsd: string }>;
  walletCount: number;
};

function mapChain(chain: string): SupportedMarketNetwork | null {
  const c = chain.toUpperCase().replace(/[-\s]/g, '_');
  if (c === 'BTC' || c === 'BITCOIN') return 'BITCOIN';
  if (c === 'ETH' || c === 'ETHEREUM') return 'ETHEREUM';
  if (c === 'BNB' || c === 'BSC' || c === 'BNB_SMART_CHAIN') return 'BNB_SMART_CHAIN';
  if (c === 'SOL' || c === 'SOLANA') return 'SOLANA';
  if (c === 'TRX' || c === 'TRON') return 'TRON';
  return null;
}

@Injectable()
export class PortfolioIntelligenceService {
  private readonly logger = new Logger(PortfolioIntelligenceService.name);

  constructor(
    @Inject(ENV) private readonly env: ServiceEnv,
    @Inject(REDIS_PORT) private readonly redis: RedisPort,
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(MarketDataEngineService) private readonly market: MarketDataEngineService,
    @Inject(MarketProviderRegistry) private readonly registry: MarketProviderRegistry,
  ) {}

  async valueHoldings(
    ownerUserId: string,
    holdings: HoldingInput[],
  ): Promise<PortfolioIntelligenceSnapshot> {
    return withMarketSpan('market.portfolio.calculate', { ownerUserId }, async () => {
      const started = Date.now();
      const cacheKey = `md:portfolio:${ownerUserId}`;
      const cached = await this.redis.get(cacheKey);
      if (cached && holdings.length === 0) {
        this.registry.metrics.cacheHits += 1;
        return JSON.parse(cached) as PortfolioIntelligenceSnapshot;
      }

      const tokenMap = new Map<
        string,
        {
          assetCode: string;
          assetSymbol: string;
          quantity: number;
          priceUsd: number;
          change24hPct: string | null;
          valueUsd: number;
          costBasis: number;
        }
      >();
      const networkMap = new Map<string, { value: number; wallets: Set<string> }>();

      for (const h of holdings) {
        const network = mapChain(h.assetChain);
        const qty = Number(h.quantity) || 0;
        let price = 0;
        let change24hPct: string | null = null;
        if (network) {
          const quote = await this.market.getQuote(h.assetSymbol, network);
          price = Number(quote?.priceUsd ?? 0);
          change24hPct = quote?.change24hPct ?? null;
        }
        const value = qty * price;
        const key = h.assetCode || h.assetSymbol;
        const existing = tokenMap.get(key) ?? {
          assetCode: h.assetCode,
          assetSymbol: h.assetSymbol,
          quantity: 0,
          priceUsd: price,
          change24hPct,
          valueUsd: 0,
          costBasis: 0,
        };
        existing.quantity += qty;
        existing.priceUsd = price || existing.priceUsd;
        existing.change24hPct = change24hPct ?? existing.change24hPct;
        existing.valueUsd += value;
        existing.costBasis += Number(h.costBasisUsd ?? 0) || 0;
        tokenMap.set(key, existing);

        const chainKey = network ?? h.assetChain;
        const net = networkMap.get(chainKey) ?? { value: 0, wallets: new Set<string>() };
        net.value += value;
        if (h.walletId) net.wallets.add(h.walletId);
        networkMap.set(chainKey, net);
      }

      const total = [...tokenMap.values()].reduce((s, t) => s + t.valueUsd, 0);
      const daily = [...tokenMap.values()].reduce((s, t) => {
        const pct = Number(t.change24hPct ?? 0) / 100;
        return s + t.valueUsd * pct;
      }, 0);
      const unrealized = [...tokenMap.values()].reduce((s, t) => {
        if (t.costBasis <= 0) return s;
        return s + (t.valueUsd - t.costBasis);
      }, 0);

      const tokenAllocation = [...tokenMap.values()]
        .map((t) => ({
          assetCode: t.assetCode,
          assetSymbol: t.assetSymbol,
          quantity: t.quantity.toFixed(8),
          priceUsd: t.priceUsd.toFixed(8),
          valueUsd: t.valueUsd.toFixed(2),
          allocationPct: total > 0 ? ((t.valueUsd / total) * 100).toFixed(2) : '0.00',
          change24hPct: t.change24hPct,
        }))
        .sort((a, b) => Number(b.valueUsd) - Number(a.valueUsd));

      const networkBreakdown = [...networkMap.entries()].map(([chain, v]) => ({
        chain,
        valueUsd: v.value.toFixed(2),
        allocationPct: total > 0 ? ((v.value / total) * 100).toFixed(2) : '0.00',
        walletCount:
          v.wallets.size ||
          holdings.filter((h) => mapChain(h.assetChain) === chain || h.assetChain === chain).length,
      }));

      const largestHoldings = tokenAllocation.slice(0, 5).map((t) => ({
        assetSymbol: t.assetSymbol,
        valueUsd: t.valueUsd,
        allocationPct: t.allocationPct,
      }));

      const historicalValue = await this.loadHistory(ownerUserId, total);

      const snapshot: PortfolioIntelligenceSnapshot = {
        ownerUserId,
        generatedAt: new Date().toISOString(),
        totalValueUsd: total.toFixed(2),
        dailyGainLossUsd: daily.toFixed(2),
        weeklyGainLossUsd: (daily * 5).toFixed(2),
        monthlyGainLossUsd: (daily * 22).toFixed(2),
        unrealizedProfitLossUsd: unrealized.toFixed(2),
        networkBreakdown,
        tokenAllocation,
        largestHoldings,
        historicalValue,
        walletCount:
          new Set(holdings.map((h) => h.walletId).filter(Boolean)).size || holdings.length,
      };

      await this.redis.set(
        cacheKey,
        JSON.stringify(snapshot),
        this.env.MARKET_DATA_PORTFOLIO_CACHE_TTL_SECONDS,
      );
      await this.persistSnapshot(snapshot);
      pushLatency(this.registry.metrics.portfolioCalcMs, Date.now() - started);
      return snapshot;
    });
  }

  private async loadHistory(
    ownerUserId: string,
    currentTotal: number,
  ): Promise<Array<{ asOf: string; totalValueUsd: string }>> {
    try {
      const rows = await this.prisma.portfolioValueSnapshot.findMany({
        where: { ownerUserId },
        orderBy: { asOf: 'asc' },
        take: 90,
      });
      const history = rows.map((r) => ({
        asOf: r.asOf.toISOString(),
        totalValueUsd: r.totalValueUsd.toString(),
      }));
      history.push({ asOf: new Date().toISOString(), totalValueUsd: currentTotal.toFixed(2) });
      return history;
    } catch {
      return [{ asOf: new Date().toISOString(), totalValueUsd: currentTotal.toFixed(2) }];
    }
  }

  private async persistSnapshot(snapshot: PortfolioIntelligenceSnapshot): Promise<void> {
    try {
      await this.prisma.portfolioValueSnapshot.create({
        data: {
          ownerUserId: snapshot.ownerUserId,
          totalValueUsd: snapshot.totalValueUsd,
          networkBreakdown: snapshot.networkBreakdown,
          tokenAllocation: snapshot.tokenAllocation,
          asOf: new Date(snapshot.generatedAt),
        },
      });
    } catch (error) {
      this.logger.debug(
        `portfolio snapshot persist skipped: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }
}
