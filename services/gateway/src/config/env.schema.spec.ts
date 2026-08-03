import { loadEnv } from './env.schema';

describe('gateway env schema — CORS production config', () => {
  it('parses localhost CORS allowlist in development', () => {
    const env = loadEnv({
      NODE_ENV: 'development',
      CORS_ORIGINS: 'http://localhost:3000,http://localhost:3001',
    });
    expect(env.CORS_ORIGINS).toEqual(['http://localhost:3000', 'http://localhost:3001']);
  });

  it('accepts production apex + www allowlist', () => {
    const env = loadEnv({
      NODE_ENV: 'production',
      CORS_ORIGINS: 'https://auvorawallet.com,https://www.auvorawallet.com',
    });
    expect(env.CORS_ORIGINS).toEqual(['https://auvorawallet.com', 'https://www.auvorawallet.com']);
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
});
