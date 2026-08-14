import { loadEnv } from './env.schema';

const base = {
  DATABASE_URL: 'postgresql://u:p@127.0.0.1:5432/db?schema=public',
  REDIS_URL: 'redis://127.0.0.1:6379',
  JWT_ACCESS_SECRET: 'x'.repeat(32),
  CSRF_SECRET: 'x'.repeat(32),
  INTERNAL_API_KEY: 'x'.repeat(32),
  CONNECTIONS_FIELD_ENCRYPTION_KEY: 'x'.repeat(32),
};

describe('connections env schema', () => {
  it('rejects simulator=true in production', () => {
    expect(() =>
      loadEnv({
        ...base,
        NODE_ENV: 'production',
        CONNECTIONS_SIMULATOR_ENABLED: 'true',
      } as never),
    ).toThrow(/CONNECTIONS_SIMULATOR_ENABLED must be false when NODE_ENV=production/);
  });

  it('accepts simulator=false in production', () => {
    const env = loadEnv({
      ...base,
      NODE_ENV: 'production',
      CONNECTIONS_SIMULATOR_ENABLED: 'false',
      CONNECTIONS_WORKERS_ENABLED: 'true',
    } as never);
    expect(env.CONNECTIONS_SIMULATOR_ENABLED).toBe(false);
    expect(env.SERVICE_NAME).toBe('connections');
  });

  it('fails when a required secret is missing', () => {
    const { INTERNAL_API_KEY: _omit, ...rest } = base;
    expect(() => loadEnv({ ...rest, NODE_ENV: 'production' } as never)).toThrow(
      /Invalid environment configuration/,
    );
  });

  it('defaults CONNECTIONS_SIGN_TIMEOUT_SECONDS to 120 and accepts a configured value', () => {
    expect(loadEnv({ ...base } as never).CONNECTIONS_SIGN_TIMEOUT_SECONDS).toBe(120);
    expect(
      loadEnv({ ...base, CONNECTIONS_SIGN_TIMEOUT_SECONDS: '300' } as never)
        .CONNECTIONS_SIGN_TIMEOUT_SECONDS,
    ).toBe(300);
  });

  it('rejects an invalid CONNECTIONS_SIGN_TIMEOUT_SECONDS (fails safely, no silent 0/negative)', () => {
    expect(() => loadEnv({ ...base, CONNECTIONS_SIGN_TIMEOUT_SECONDS: '0' } as never)).toThrow(
      /Invalid environment configuration/,
    );
    expect(() => loadEnv({ ...base, CONNECTIONS_SIGN_TIMEOUT_SECONDS: '-5' } as never)).toThrow(
      /Invalid environment configuration/,
    );
    expect(() => loadEnv({ ...base, CONNECTIONS_SIGN_TIMEOUT_SECONDS: 'abc' } as never)).toThrow(
      /Invalid environment configuration/,
    );
  });
});
