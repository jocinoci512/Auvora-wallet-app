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
});
