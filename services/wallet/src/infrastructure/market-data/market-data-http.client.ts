import { Inject, Injectable, Logger } from '@nestjs/common';
import { ENV, type ServiceEnv } from '../../config/env.schema';

export const MARKET_DATA_HTTP_CLIENT = Symbol('MARKET_DATA_HTTP_CLIENT');

export type MarketValuationResult = {
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
};

export interface MarketDataHttpClientPort {
  isConfigured(): boolean;
  valueHoldings(
    ownerUserId: string,
    holdings: Array<{
      walletId?: string;
      assetCode: string;
      assetSymbol: string;
      assetChain: string;
      quantity: string;
    }>,
  ): Promise<MarketValuationResult | null>;
}

interface Envelope<T> {
  data?: T;
}

@Injectable()
export class MarketDataHttpClientAdapter implements MarketDataHttpClientPort {
  private readonly logger = new Logger(MarketDataHttpClientAdapter.name);
  private readonly baseUrl?: string;
  private readonly apiKey?: string;

  constructor(@Inject(ENV) env: ServiceEnv) {
    this.baseUrl = env.MARKET_DATA_SERVICE_URL;
    this.apiKey = env.INTERNAL_API_KEY;
  }

  isConfigured(): boolean {
    return Boolean(this.baseUrl && this.apiKey);
  }

  async valueHoldings(
    ownerUserId: string,
    holdings: Array<{
      walletId?: string;
      assetCode: string;
      assetSymbol: string;
      assetChain: string;
      quantity: string;
    }>,
  ): Promise<MarketValuationResult | null> {
    if (!this.isConfigured()) return null;
    try {
      const url = `${this.baseUrl!.replace(/\/$/, '')}/api/v1/internal/market-data/valuation`;
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-internal-api-key': this.apiKey!,
        },
        body: JSON.stringify({ ownerUserId, holdings }),
        signal: AbortSignal.timeout(10_000),
      });
      if (!response.ok) {
        this.logger.warn(`Market-data valuation HTTP ${response.status}`);
        return null;
      }
      const body = (await response.json()) as Envelope<MarketValuationResult>;
      return body.data ?? null;
    } catch (error) {
      this.logger.warn(
        `Market-data valuation failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      return null;
    }
  }
}
