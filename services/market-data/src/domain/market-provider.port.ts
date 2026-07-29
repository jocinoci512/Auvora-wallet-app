export type SupportedMarketNetwork = 'ETHEREUM' | 'BNB_SMART_CHAIN' | 'SOLANA' | 'TRON' | 'BITCOIN';

export type MarketQuote = {
  symbol: string;
  network: SupportedMarketNetwork;
  contractAddress?: string | null;
  priceUsd: string;
  change24hPct: string | null;
  change7dPct: string | null;
  marketCapUsd: string | null;
  volume24hUsd: string | null;
  circulatingSupply: string | null;
  fullyDilutedValuationUsd: string | null;
  source: string;
  asOf: string;
};

export type OhlcBar = {
  bucketStart: string;
  open: string;
  high: string;
  low: string;
  close: string;
  volume: string | null;
};

export type TokenMetadataSnapshot = {
  symbol: string;
  name: string;
  network: SupportedMarketNetwork;
  logoUrl: string | null;
  decimals: number;
  contractAddress: string | null;
  tokenType: string;
  verificationStatus: 'UNVERIFIED' | 'VERIFIED' | 'SUSPICIOUS';
  circulatingSupply: string | null;
  totalSupply: string | null;
  maxSupply: string | null;
  externalIds: Record<string, string>;
};

export type TrendingAsset = {
  symbol: string;
  network: SupportedMarketNetwork;
  priceUsd: string;
  change24hPct: string;
  volume24hUsd: string | null;
  rank: number;
};

export const MARKET_DATA_PROVIDER = Symbol('MARKET_DATA_PROVIDER');

export interface MarketDataProviderPort {
  readonly code: string;
  readonly name: string;
  getNativePrice(symbol: string, network: SupportedMarketNetwork): Promise<MarketQuote | null>;
  getTokenPrice(
    contractAddress: string,
    network: SupportedMarketNetwork,
  ): Promise<MarketQuote | null>;
  getHistoricalPrices(
    symbol: string,
    network: SupportedMarketNetwork,
    from: Date,
    to: Date,
  ): Promise<Array<{ asOf: string; priceUsd: string }>>;
  getOhlc(
    symbol: string,
    network: SupportedMarketNetwork,
    interval: 'MINUTE' | 'HOUR' | 'DAY',
    from: Date,
    to: Date,
  ): Promise<OhlcBar[]>;
  getMarketStats(symbol: string, network: SupportedMarketNetwork): Promise<MarketQuote | null>;
  getTrending(): Promise<TrendingAsset[]>;
  getTokenMetadata(
    symbol: string,
    network: SupportedMarketNetwork,
  ): Promise<TokenMetadataSnapshot | null>;
}
