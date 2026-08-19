import { loadEnv } from './env.schema';

const base = {
  DATABASE_URL: 'postgresql://auvora:auvora@localhost:5432/auvora_wallet',
  REDIS_URL: 'redis://localhost:6379',
  JWT_ACCESS_SECRET: 'a'.repeat(32),
  JWT_REFRESH_SECRET: 'b'.repeat(32),
  CSRF_SECRET: 'c'.repeat(32),
  AUTH_FIELD_ENCRYPTION_KEY: 'e'.repeat(32),
};

describe('auth env schema — origin / cookie / CORS production config', () => {
  it('keeps localhost APP_PUBLIC_URL and CORS for development', () => {
    const env = loadEnv({
      ...base,
      NODE_ENV: 'development',
      APP_PUBLIC_URL: 'http://localhost:3000',
      CORS_ORIGINS: 'http://localhost:3001',
      COOKIE_SECURE: 'false',
      COOKIE_DOMAIN: '',
    });
    expect(env.APP_PUBLIC_URL).toBe('http://localhost:3000');
    expect(env.corsOrigins).toEqual(['http://localhost:3000', 'http://localhost:3001']);
    expect(env.COOKIE_SECURE).toBe(false);
  });

  it('accepts production apex + www + admin allowlist with Secure cookies and host-only domain', () => {
    const env = loadEnv({
      ...base,
      NODE_ENV: 'production',
      APP_PUBLIC_URL: 'https://auvorawallet.com',
      CORS_ORIGINS: 'https://www.auvorawallet.com,https://admin.auvorawallet.com',
      COOKIE_SECURE: 'true',
      COOKIE_DOMAIN: '',
      MAIL_DRIVER: 'smtp',
      SMTP_HOST: 'smtp.resend.com',
      SMTP_PORT: '587',
      SMTP_FROM: 'noreply@auvorawallet.com',
    });
    expect(env.APP_PUBLIC_URL).toBe('https://auvorawallet.com');
    expect(env.corsOrigins).toEqual([
      'https://auvorawallet.com',
      'https://www.auvorawallet.com',
      'https://admin.auvorawallet.com',
    ]);
    expect(env.COOKIE_SECURE).toBe(true);
    expect(env.COOKIE_DOMAIN ?? '').toBe('');
  });

  it('rejects production localhost APP_PUBLIC_URL', () => {
    expect(() =>
      loadEnv({
        ...base,
        NODE_ENV: 'production',
        APP_PUBLIC_URL: 'http://localhost:3000',
        COOKIE_SECURE: 'true',
      }),
    ).toThrow(/APP_PUBLIC_URL/);
  });

  it('rejects wildcard CORS', () => {
    expect(() =>
      loadEnv({
        ...base,
        NODE_ENV: 'development',
        APP_PUBLIC_URL: 'http://localhost:3000',
        CORS_ORIGINS: '*',
      }),
    ).toThrow(/wildcard|CORS/i);
  });

  it('rejects COOKIE_SECURE=false in production', () => {
    expect(() =>
      loadEnv({
        ...base,
        NODE_ENV: 'production',
        APP_PUBLIC_URL: 'https://auvorawallet.com',
        COOKIE_SECURE: 'false',
      }),
    ).toThrow(/COOKIE_SECURE/);
  });

  it('defaults COOKIE_SECURE true when NODE_ENV=production and unset', () => {
    const env = loadEnv({
      ...base,
      NODE_ENV: 'production',
      APP_PUBLIC_URL: 'https://auvorawallet.com',
      MAIL_DRIVER: 'smtp',
      SMTP_HOST: 'smtp.resend.com',
      SMTP_PORT: '587',
      SMTP_FROM: 'noreply@auvorawallet.com',
    });
    expect(env.COOKIE_SECURE).toBe(true);
  });
});
