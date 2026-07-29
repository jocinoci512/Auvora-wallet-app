import { SimulatorMarketProvider } from './simulator-market.provider';

describe('SimulatorMarketProvider', () => {
  const provider = new SimulatorMarketProvider();

  it('returns native prices for supported networks', async () => {
    const eth = await provider.getNativePrice('ETH', 'ETHEREUM');
    expect(eth).not.toBeNull();
    expect(eth!.source).toBe('simulator');
    expect(Number(eth!.priceUsd)).toBeGreaterThan(0);
    expect(eth!.marketCapUsd).toBeTruthy();
    expect(eth!.volume24hUsd).toBeTruthy();
  });

  it('returns OHLC bars', async () => {
    const from = new Date(Date.now() - 86_400_000);
    const to = new Date();
    const bars = await provider.getOhlc('BTC', 'BITCOIN', 'HOUR', from, to);
    expect(bars.length).toBeGreaterThan(0);
    expect(bars[0]!.open).toBeDefined();
    expect(bars[0]!.high).toBeDefined();
  });

  it('returns trending assets', async () => {
    const trending = await provider.getTrending();
    expect(trending.length).toBe(5);
    expect(trending[0]!.symbol).toBeTruthy();
  });

  it('returns token metadata', async () => {
    const meta = await provider.getTokenMetadata('SOL', 'SOLANA');
    expect(meta?.name).toBe('Solana');
    expect(meta?.verificationStatus).toBe('VERIFIED');
  });
});
