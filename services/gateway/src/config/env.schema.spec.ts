import { loadEnv } from './env.schema';

describe('gateway env schema — CORS production config', () => {
  it('parses localhost CORS allowlist in development', () => {
    const env = loadEnv({
      NODE_ENV: 'development',
      CORS_ORIGINS: 'http://localhost:3000,http://localhost:3001',
    });
    expect(env.CORS_ORIGINS).toEqual(['http://localhost:3000', 'http://localhost:3001']);
  });

  it('uses localhost CORS default when unset in development', () => {
    const env = loadEnv({
      NODE_ENV: 'development',
    });
    expect(env.CORS_ORIGINS).toEqual(['http://localhost:3000', 'http://localhost:3001']);
  });

  it('accepts production apex + www allowlist', () => {
    const env = loadEnv({
      NODE_ENV: 'production',
      CORS_ORIGINS:
        'https://auvorawallet.com,https://www.auvorawallet.com,https://admin.auvorawallet.com',
    });
    expect(env.CORS_ORIGINS).toEqual([
      'https://auvorawallet.com',
      'https://www.auvorawallet.com',
      'https://admin.auvorawallet.com',
    ]);
  });

  it('requires CORS_ORIGINS in production (no localhost default)', () => {
    expect(() =>
      loadEnv({
        NODE_ENV: 'production',
      }),
    ).toThrow(/CORS_ORIGINS is required in production/i);
  });

  it('rejects wildcard credentialed CORS', () => {
    expect(() =>
      loadEnv({
        NODE_ENV: 'development',
        CORS_ORIGINS: '*',
      }),
    ).toThrow(/wildcard|CORS/i);
  });

  it('rejects localhost CORS in production', () => {
    expect(() =>
      loadEnv({
        NODE_ENV: 'production',
        CORS_ORIGINS: 'https://auvorawallet.com,http://localhost:3000',
      }),
    ).toThrow(/not allowed in production|CORS/i);
  });

  it('treats empty-string optional URLs as unset (Railway dashboard footgun)', () => {
    const env = loadEnv({
      NODE_ENV: 'development',
      DATABASE_URL: '',
      REDIS_URL: '   ',
      AUTH_SERVICE_URL: '',
      INTERNAL_API_KEY: '',
    });
    expect(env.DATABASE_URL).toBeUndefined();
    expect(env.REDIS_URL).toBeUndefined();
    expect(env.AUTH_SERVICE_URL).toBe('http://127.0.0.1:4001');
    expect(env.INTERNAL_API_KEY).toBeUndefined();
  });

  it('treats empty CORS_ORIGINS as unset in development', () => {
    const env = loadEnv({
      NODE_ENV: 'development',
      CORS_ORIGINS: '',
    });
    expect(env.CORS_ORIGINS).toEqual(['http://localhost:3000', 'http://localhost:3001']);
  });

  it('explains unresolved Railway templates for required AUTH upstream', () => {
    expect(() =>
      loadEnv({
        NODE_ENV: 'development',
        AUTH_SERVICE_URL: 'http://${{auth-prods.RAILWAY_PRIVATE_DOMAIN}}:4001',
      }),
    ).toThrow(/unresolved Railway template|quote it/i);
  });

  it('falls back optional upstreams when Railway private domain is empty', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    const env = loadEnv({
      NODE_ENV: 'production',
      CORS_ORIGINS: 'https://auvorawallet.com,https://www.auvorawallet.com',
      AUTH_SERVICE_URL: 'http://auth-prods.railway.internal:4001',
      WALLET_SERVICE_URL: 'http://:3002',
      MARKET_DATA_SERVICE_URL: 'http://:3012',
    });
    expect(env.WALLET_SERVICE_URL).toBe('http://127.0.0.1:3002');
    expect(env.MARKET_DATA_SERVICE_URL).toBe('http://127.0.0.1:3012');
    expect(env.AUTH_SERVICE_URL).toBe('http://auth-prods.railway.internal:4001');
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('still fails hard when required AUTH has empty hostname', () => {
    expect(() =>
      loadEnv({
        NODE_ENV: 'production',
        CORS_ORIGINS: 'https://auvorawallet.com',
        AUTH_SERVICE_URL: 'http://:4001',
      }),
    ).toThrow(/AUTH_SERVICE_URL: empty\/invalid hostname/i);
  });

  it('accepts quoted-style Railway private URLs once resolved', () => {
    const env = loadEnv({
      NODE_ENV: 'development',
      MARKET_DATA_SERVICE_URL: 'http://market-data.railway.internal:3012',
      WALLET_SERVICE_URL: 'http://wallet.railway.internal:3002',
    });
    expect(env.MARKET_DATA_SERVICE_URL).toBe('http://market-data.railway.internal:3012');
    expect(env.WALLET_SERVICE_URL).toBe('http://wallet.railway.internal:3002');
  });
});
