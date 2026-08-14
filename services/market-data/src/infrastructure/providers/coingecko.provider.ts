import { Inject, Injectable, Logger } from '@nestjs/common';
import { ENV, type ServiceEnv } from '../../config/env.schema';
import { ProviderUnavailableError } from '../../domain/errors';
import {
  sanitizeNonNegativeString,
  sanitizePercentString,
  sanitizeQuote,
} from '../../domain/market-data.validation';
import type {
  MarketDataProviderPort,
  MarketQuote,
  OhlcBar,
  SupportedMarketNetwork,
  TokenMetadataSnapshot,
  TrendingAsset,
} from '../../domain/market-provider.port';

type CoinGeckoPriceRow = {
  usd?: number;
  usd_24h_change?: number;
  usd_market_cap?: number;
  usd_24h_vol?: number;
};

const NETWORK_TO_PLATFORM: Partial<Record<SupportedMarketNetwork, string>> = {
  ETHEREUM: 'ethereum',
  BNB_SMART_CHAIN: 'binance-smart-chain',
  SOLANA: 'solana',
  TRON: 'tron',
};

const SYMBOL_TO_ID: Record<string, string> = {
  BTC: 'bitcoin',
  ETH: 'ethereum',
  BNB: 'binancecoin',
  SOL: 'solana',
  TRX: 'tron',
};

export function redactUrl(url: string): string {
  return url
    .replace(/([?&]x_cg_pro_api_key=)[^&]+/i, '$1***')
    .replace(/(\/api\/v3\/)[^/]+/g, '$1***');
}

@Injectable()
export class CoinGeckoMarketProvider implements MarketDataProviderPort {
  readonly code = 'coingecko';
  readonly name = 'CoinGecko';
  private readonly logger = new Logger(CoinGeckoMarketProvider.name);
  private readonly baseUrl: string;
  private readonly apiKey?: string;

  constructor(@Inject(ENV) env: ServiceEnv) {
    this.baseUrl = env.COINGECKO_BASE_URL.replace(/\/$/, '');
    this.apiKey = env.COINGECKO_API_KEY;
  }

  private mapPriceRow(
    symbol: string,
    network: SupportedMarketNetwork,
    row: CoinGeckoPriceRow | undefined,
  ): MarketQuote | null {
    if (!row) return null;
    // Validate the provider payload before it can enter cache / DB / API output.
    return sanitizeQuote({
      symbol: symbol.toUpperCase(),
      network,
      contractAddress: null,
      priceUsd: row.usd,
      change24hPct: row.usd_24h_change,
      change7dPct: null,
      marketCapUsd: row.usd_market_cap,
      volume24hUsd: row.usd_24h_vol,
      circulatingSupply: null,
      fullyDilutedValuationUsd: null,
      source: this.code,
      asOf: new Date().toISOString(),
    });
  }

  async getNativePrice(
    symbol: string,
    network: SupportedMarketNetwork,
  ): Promise<MarketQuote | null> {
    const id = SYMBOL_TO_ID[symbol.toUpperCase()];
    if (!id) return null;
    const data = await this.getJson<Record<string, CoinGeckoPriceRow>>(
      `/simple/price?ids=${encodeURIComponent(id)}&vs_currencies=usd&include_24hr_change=true&include_market_cap=true&include_24hr_vol=true`,
    );
    return this.mapPriceRow(symbol, network, data?.[id]);
  }

  /**
   * Batched native price fetch — a single CoinGecko `/simple/price` call for all
   * requested assets (CoinGecko supports comma-separated ids). This replaces N
   * per-asset requests with one, sharply reducing provider request volume.
   */
  async getNativePrices(
    assets: Array<{ symbol: string; network: SupportedMarketNetwork }>,
  ): Promise<MarketQuote[]> {
    const known = assets
      .map((a) => ({ ...a, id: SYMBOL_TO_ID[a.symbol.toUpperCase()] }))
      .filter((a): a is typeof a & { id: string } => Boolean(a.id));
    if (known.length === 0) return [];
    const ids = [...new Set(known.map((a) => a.id))].join(',');
    const data = await this.getJson<Record<string, CoinGeckoPriceRow>>(
      `/simple/price?ids=${encodeURIComponent(ids)}&vs_currencies=usd&include_24hr_change=true&include_market_cap=true&include_24hr_vol=true`,
    );
    const out: MarketQuote[] = [];
    for (const asset of known) {
      const quote = this.mapPriceRow(asset.symbol, asset.network, data?.[asset.id]);
      if (quote) out.push(quote);
    }
    return out;
  }

  async getTokenPrice(
    contractAddress: string,
    network: SupportedMarketNetwork,
  ): Promise<MarketQuote | null> {
    const platform = NETWORK_TO_PLATFORM[network];
    if (!platform) return null;
    const data = await this.getJson<Record<string, { usd?: number; usd_24h_change?: number }>>(
      `/simple/token_price/${platform}?contract_addresses=${encodeURIComponent(contractAddress)}&vs_currencies=usd&include_24hr_change=true`,
    );
    const row = data?.[contractAddress.toLowerCase()];
    if (!row?.usd) return null;
    return sanitizeQuote({
      symbol: contractAddress.slice(0, 6).toUpperCase(),
      network,
      contractAddress,
      priceUsd: row.usd,
      change24hPct: row.usd_24h_change,
      change7dPct: null,
      marketCapUsd: null,
      volume24hUsd: null,
      circulatingSupply: null,
      fullyDilutedValuationUsd: null,
      source: this.code,
      asOf: new Date().toISOString(),
    });
  }

  async getHistoricalPrices(
    symbol: string,
    _network: SupportedMarketNetwork,
    from: Date,
    to: Date,
  ): Promise<Array<{ asOf: string; priceUsd: string }>> {
    const id = SYMBOL_TO_ID[symbol.toUpperCase()];
    if (!id) return [];
    const data = await this.getJson<{ prices?: Array<[number, number]> }>(
      `/coins/${id}/market_chart/range?vs_currency=usd&from=${Math.floor(from.getTime() / 1000)}&to=${Math.floor(to.getTime() / 1000)}`,
    );
    return (data?.prices ?? []).map(([ms, price]) => ({
      asOf: new Date(ms).toISOString(),
      priceUsd: String(price),
    }));
  }

  async getOhlc(
    symbol: string,
    _network: SupportedMarketNetwork,
    _interval: 'MINUTE' | 'HOUR' | 'DAY',
    from: Date,
    to: Date,
  ): Promise<OhlcBar[]> {
    const id = SYMBOL_TO_ID[symbol.toUpperCase()];
    if (!id) return [];
    const days = Math.max(1, Math.ceil((to.getTime() - from.getTime()) / 86_400_000));
    const data = await this.getJson<Array<[number, number, number, number, number]>>(
      `/coins/${id}/ohlc?vs_currency=usd&days=${Math.min(days, 365)}`,
    );
    if (!Array.isArray(data)) return [];
    return data.map(([ms, open, high, low, close]) => ({
      bucketStart: new Date(ms).toISOString(),
      open: String(open),
      high: String(high),
      low: String(low),
      close: String(close),
      volume: null,
    }));
  }

  async getMarketStats(
    symbol: string,
    network: SupportedMarketNetwork,
  ): Promise<MarketQuote | null> {
    return this.getNativePrice(symbol, network);
  }

  async getTrending(): Promise<TrendingAsset[]> {
    const data = await this.getJson<{
      coins?: Array<{
        item?: {
          symbol?: string;
          score?: number;
          data?: { price?: number; price_change_percentage_24h?: { usd?: number } };
        };
      }>;
    }>('/search/trending');
    const out: TrendingAsset[] = [];
    for (const [index, c] of (data?.coins ?? []).entries()) {
      const item = c.item;
      if (!item?.symbol) continue;
      out.push({
        symbol: item.symbol.toUpperCase(),
        network: 'ETHEREUM',
        priceUsd: sanitizeNonNegativeString(item.data?.price) ?? '0',
        change24hPct: sanitizePercentString(item.data?.price_change_percentage_24h?.usd) ?? '0',
        volume24hUsd: null,
        rank: (item.score ?? index) + 1,
      });
    }
    return out.slice(0, 10);
  }

  async getTokenMetadata(
    symbol: string,
    network: SupportedMarketNetwork,
  ): Promise<TokenMetadataSnapshot | null> {
    const id = SYMBOL_TO_ID[symbol.toUpperCase()];
    if (!id) return null;
    const data = await this.getJson<{
      name?: string;
      symbol?: string;
      image?: { large?: string };
      detail_platforms?: Record<string, { decimal_place?: number; contract_address?: string }>;
      market_data?: {
        circulating_supply?: number;
        total_supply?: number;
        max_supply?: number;
      };
    }>(`/coins/${id}`);
    if (!data?.symbol) return null;
    return {
      symbol: data.symbol.toUpperCase(),
      name: data.name ?? symbol,
      network,
      logoUrl: data.image?.large ?? null,
      decimals: 8,
      contractAddress: null,
      tokenType: 'NATIVE',
      verificationStatus: 'VERIFIED',
      circulatingSupply:
        data.market_data?.circulating_supply != null
          ? String(data.market_data.circulating_supply)
          : null,
      totalSupply:
        data.market_data?.total_supply != null ? String(data.market_data.total_supply) : null,
      maxSupply: data.market_data?.max_supply != null ? String(data.market_data.max_supply) : null,
      externalIds: { coingeckoId: id },
    };
  }

  private async getJson<T>(path: string): Promise<T | null> {
    const url = new URL(`${this.baseUrl}${path.startsWith('/') ? path : `/${path}`}`);
    if (this.apiKey) {
      url.searchParams.set('x_cg_pro_api_key', this.apiKey);
    }
    try {
      const response = await fetch(url.toString(), {
        headers: { accept: 'application/json' },
        signal: AbortSignal.timeout(10_000),
      });
      if (!response.ok) {
        this.logger.warn(`CoinGecko HTTP ${response.status} for ${redactUrl(url.toString())}`);
        if (response.status >= 500) {
          throw new ProviderUnavailableError(`CoinGecko unavailable (${response.status})`);
        }
        return null;
      }
      return (await response.json()) as T;
    } catch (error) {
      if (error instanceof ProviderUnavailableError) throw error;
      this.logger.warn(
        `CoinGecko request failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw new ProviderUnavailableError('CoinGecko request failed');
    }
  }
}
