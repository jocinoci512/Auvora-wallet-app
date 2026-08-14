import { CoinGeckoMarketProvider } from './coingecko.provider';
import type { ServiceEnv } from '../../config/env.schema';

const env = {
  COINGECKO_BASE_URL: 'https://api.coingecko.com/api/v3',
  COINGECKO_API_KEY: undefined,
} as unknown as ServiceEnv;

describe('CoinGeckoMarketProvider.getNativePrices (batch)', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('fetches all assets in a single request and validates prices', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        bitcoin: { usd: 65000, usd_24h_change: 1.2, usd_market_cap: 1_000, usd_24h_vol: 2_000 },
        ethereum: { usd: 3500, usd_24h_change: -0.5 },
      }),
    });
    (globalThis as { fetch: typeof fetch }).fetch = fetchMock as unknown as typeof fetch;

    const provider = new CoinGeckoMarketProvider(env);
    const quotes = await provider.getNativePrices([
      { symbol: 'BTC', network: 'BITCOIN' },
      { symbol: 'ETH', network: 'ETHEREUM' },
    ]);

    // Single upstream call for the whole batch.
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const calledUrl = String(fetchMock.mock.calls[0][0]);
    expect(calledUrl).toContain('ids=bitcoin%2Cethereum');
    expect(quotes).toHaveLength(2);
    expect(quotes.find((q) => q.symbol === 'BTC')?.priceUsd).toBe('65000');
    expect(quotes.find((q) => q.symbol === 'ETH')?.priceUsd).toBe('3500');
  });

  it('drops assets whose provider price is invalid (e.g. negative)', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        bitcoin: { usd: 65000 },
        ethereum: { usd: -1 },
      }),
    });
    (globalThis as { fetch: typeof fetch }).fetch = fetchMock as unknown as typeof fetch;

    const provider = new CoinGeckoMarketProvider(env);
    const quotes = await provider.getNativePrices([
      { symbol: 'BTC', network: 'BITCOIN' },
      { symbol: 'ETH', network: 'ETHEREUM' },
    ]);

    expect(quotes).toHaveLength(1);
    expect(quotes[0].symbol).toBe('BTC');
  });
});
