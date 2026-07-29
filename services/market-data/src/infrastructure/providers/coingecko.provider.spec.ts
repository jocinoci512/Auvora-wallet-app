import { redactUrl } from './coingecko.provider';

describe('CoinGeckoMarketProvider helpers', () => {
  it('redacts API keys from URLs', () => {
    const url =
      'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&x_cg_pro_api_key=secret123';
    expect(redactUrl(url)).not.toContain('secret123');
    expect(redactUrl(url)).toContain('x_cg_pro_api_key=***');
  });
});
