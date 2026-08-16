import { loadEnv } from './env.schema';

const base = {
  DATABASE_URL: 'postgresql://auvora:auvora@localhost:5432/auvora_wallet',
  REDIS_URL: 'redis://localhost:6379',
  JWT_ACCESS_SECRET: 'a'.repeat(32),
  JWT_REFRESH_SECRET: 'b'.repeat(32),
  CSRF_SECRET: 'c'.repeat(32),
  AUTH_FIELD_ENCRYPTION_KEY: 'e'.repeat(32),
  APP_PUBLIC_URL: 'https://auvorawallet.com',
};

describe('auth env schema — mail production guards', () => {
  it('allows console mail in development', () => {
    const env = loadEnv({
      ...base,
      NODE_ENV: 'development',
      APP_PUBLIC_URL: 'http://localhost:3000',
      MAIL_DRIVER: 'console',
      COOKIE_SECURE: 'false',
    });
    expect(env.MAIL_DRIVER).toBe('console');
    expect(env.SMTP_FROM_NAME).toBe('Auvora Wallet');
    expect(env.MAIL_RATE_LIMIT_MAX).toBe(5);
  });

  it('rejects console mail in production', () => {
    expect(() =>
      loadEnv({
        ...base,
        NODE_ENV: 'production',
        MAIL_DRIVER: 'console',
        COOKIE_SECURE: 'true',
      }),
    ).toThrow(/MAIL_DRIVER/);
  });

  it('requires SMTP fields when MAIL_DRIVER=smtp', () => {
    expect(() =>
      loadEnv({
        ...base,
        NODE_ENV: 'production',
        MAIL_DRIVER: 'smtp',
        COOKIE_SECURE: 'true',
      }),
    ).toThrow(/SMTP_/);
  });

  it('accepts production smtp with required fields', () => {
    const env = loadEnv({
      ...base,
      NODE_ENV: 'production',
      MAIL_DRIVER: 'smtp',
      SMTP_HOST: 'smtp.resend.com',
      SMTP_PORT: '587',
      SMTP_FROM: 'noreply@auvorawallet.com',
      SMTP_FROM_NAME: 'Auvora Wallet',
      COOKIE_SECURE: 'true',
    });
    expect(env.MAIL_DRIVER).toBe('smtp');
    expect(env.SMTP_HOST).toBe('smtp.resend.com');
    expect(env.APP_PUBLIC_URL).toBe('https://auvorawallet.com');
  });

  it('requires notifications URL and key when MAIL_DRIVER=notifications', () => {
    expect(() =>
      loadEnv({
        ...base,
        NODE_ENV: 'production',
        MAIL_DRIVER: 'notifications',
        COOKIE_SECURE: 'true',
      }),
    ).toThrow(/NOTIFICATIONS_SERVICE_URL|INTERNAL_API_KEY/);
  });
});
