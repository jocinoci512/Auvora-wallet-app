import { loadEnv } from './env.schema';

const secrets = {
  DATABASE_URL: 'postgresql://user:pass@localhost:5432/auvora',
  REDIS_URL: 'redis://localhost:6379',
  JWT_ACCESS_SECRET: 'x'.repeat(32),
  CSRF_SECRET: 'y'.repeat(32),
  INTERNAL_API_KEY: 'z'.repeat(32),
};

describe('wallet loadEnv production gates', () => {
  it('accepts intended wallet-prod variables', () => {
    const env = loadEnv({
      ...secrets,
      NODE_ENV: 'production',
      PORT: '3002',
      LOG_LEVEL: 'warn',
      WALLET_WORKERS_ENABLED: 'true',
      OTEL_ENABLED: 'false',
      APP_PUBLIC_URL: 'https://auvorawallet.com',
      BLOCKCHAIN_SERVICE_URL: 'http://blockchain-prod.railway.internal:3003',
    });
    expect(env.PORT).toBe(3002);
    expect(env.WALLET_WORKERS_ENABLED).toBe(true);
    expect(env.BLOCKCHAIN_SERVICE_URL).toContain(':3003');
  });

  it('requires BLOCKCHAIN_SERVICE_URL in production', () => {
    expect(() =>
      loadEnv({
        ...secrets,
        NODE_ENV: 'production',
      }),
    ).toThrow(/BLOCKCHAIN_SERVICE_URL/);
  });

  it('rejects unresolved Railway blockchain URL hosts', () => {
    expect(() =>
      loadEnv({
        ...secrets,
        NODE_ENV: 'production',
        BLOCKCHAIN_SERVICE_URL: 'http://:3003',
      }),
    ).toThrow(/BLOCKCHAIN_SERVICE_URL|Invalid url|empty host/);
  });

  it('does not require JWT_REFRESH_SECRET or ALCHEMY_API_KEY', () => {
    const env = loadEnv({
      ...secrets,
      NODE_ENV: 'production',
      BLOCKCHAIN_SERVICE_URL: 'http://blockchain-prod.railway.internal:3003',
    });
    expect(env.JWT_ACCESS_SECRET).toHaveLength(32);
    expect((env as Record<string, unknown>).JWT_REFRESH_SECRET).toBeUndefined();
    expect((env as Record<string, unknown>).ALCHEMY_API_KEY).toBeUndefined();
  });
});
