import { loadEnv } from './env.schema';

const secrets = {
  DATABASE_URL: 'postgresql://user:pass@localhost:5432/auvora',
  REDIS_URL: 'redis://localhost:6379',
  JWT_ACCESS_SECRET: 'x'.repeat(32),
  CSRF_SECRET: 'y'.repeat(32),
  ALCHEMY_API_KEY: 'alchemy-test-key',
};

describe('blockchain loadEnv production gates', () => {
  it('accepts intended blockchain-prod variables', () => {
    const env = loadEnv({
      ...secrets,
      NODE_ENV: 'production',
      PORT: '3003',
      LOG_LEVEL: 'warn',
      BLOCKCHAIN_SIMULATOR_ENABLED: 'false',
      BLOCKCHAIN_LIVE_BROADCAST: 'false',
      BLOCKCHAIN_PRIMARY_PROVIDER: 'alchemy',
      ALCHEMY_REQUIRED: 'true',
      OTEL_ENABLED: 'false',
      INTERNAL_API_KEY: 'z'.repeat(32),
    });
    expect(env.PORT).toBe(3003);
    expect(env.BLOCKCHAIN_LIVE_BROADCAST).toBe(false);
    expect(env.BLOCKCHAIN_PRIMARY_PROVIDER).toBe('alchemy');
    expect(env.BLOCKCHAIN_NETWORK_ENV).toBe('mainnet');
    expect(env.BLOCKCHAIN_TESTNET_BROADCAST).toBe(false);
  });

  it('rejects live broadcast in production', () => {
    expect(() =>
      loadEnv({
        ...secrets,
        NODE_ENV: 'production',
        BLOCKCHAIN_LIVE_BROADCAST: 'true',
      }),
    ).toThrow(/BLOCKCHAIN_LIVE_BROADCAST/);
  });

  it('rejects simulator in production', () => {
    expect(() =>
      loadEnv({
        ...secrets,
        NODE_ENV: 'production',
        BLOCKCHAIN_SIMULATOR_ENABLED: 'true',
      }),
    ).toThrow(/BLOCKCHAIN_SIMULATOR_ENABLED/);
  });

  it('rejects TESTNET_BROADCAST without NETWORK_ENV=testnet', () => {
    expect(() =>
      loadEnv({
        ...secrets,
        NODE_ENV: 'development',
        BLOCKCHAIN_TESTNET_BROADCAST: 'true',
        BLOCKCHAIN_NETWORK_ENV: 'mainnet',
      }),
    ).toThrow(/BLOCKCHAIN_TESTNET_BROADCAST/);
  });

  it('accepts testnet broadcast when NETWORK_ENV=testnet', () => {
    const env = loadEnv({
      ...secrets,
      NODE_ENV: 'development',
      BLOCKCHAIN_LIVE_BROADCAST: 'false',
      BLOCKCHAIN_NETWORK_ENV: 'testnet',
      BLOCKCHAIN_TESTNET_BROADCAST: 'true',
    });
    expect(env.BLOCKCHAIN_NETWORK_ENV).toBe('testnet');
    expect(env.BLOCKCHAIN_TESTNET_BROADCAST).toBe(true);
    expect(env.BLOCKCHAIN_LIVE_BROADCAST).toBe(false);
  });

  it('rejects LIVE and TESTNET broadcast both true', () => {
    expect(() =>
      loadEnv({
        ...secrets,
        NODE_ENV: 'development',
        BLOCKCHAIN_LIVE_BROADCAST: 'true',
        BLOCKCHAIN_NETWORK_ENV: 'testnet',
        BLOCKCHAIN_TESTNET_BROADCAST: 'true',
      }),
    ).toThrow(/cannot both be true/);
  });

  it('does not require JWT_REFRESH_SECRET', () => {
    const env = loadEnv({
      ...secrets,
      NODE_ENV: 'production',
      ALCHEMY_REQUIRED: 'true',
      INTERNAL_API_KEY: 'z'.repeat(32),
    });
    expect(env.JWT_ACCESS_SECRET).toHaveLength(32);
    expect((env as Record<string, unknown>).JWT_REFRESH_SECRET).toBeUndefined();
  });

  it('requires INTERNAL_API_KEY in production', () => {
    expect(() =>
      loadEnv({
        ...secrets,
        NODE_ENV: 'production',
        ALCHEMY_REQUIRED: 'true',
      }),
    ).toThrow(/INTERNAL_API_KEY/);
  });
});
