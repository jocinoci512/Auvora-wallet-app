import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const jwt = 'e2e-admin-jwt-access-secret-32chars-min!!';
const refresh = 'e2e-admin-jwt-refresh-secret-32chars-min';
const csrf = 'e2e-admin-csrf-secret-32characters-min!';
const field = 'e2e-admin-field-encryption-key-32ch!!';

const env = {
  ...process.env,
  NODE_ENV: 'development',
  COOKIE_SECURE: 'true',
  DATABASE_URL: 'postgresql://auvora:auvora@127.0.0.1:54329/auvora_e2e?schema=public',
  REDIS_URL: 'redis://127.0.0.1:63799',
  JWT_ACCESS_SECRET: jwt,
  JWT_REFRESH_SECRET: refresh,
  JWT_ACCESS_TTL_SECONDS: '900',
  JWT_REFRESH_TTL_SECONDS: '604800',
  CSRF_SECRET: csrf,
  AUTH_FIELD_ENCRYPTION_KEY: field,
  APP_PUBLIC_URL: 'http://127.0.0.1:3000',
  CORS_ORIGINS: 'http://127.0.0.1:3001,http://localhost:3001',
  MAIL_DRIVER: 'console',
  AUTH_PORT: '4001',
  PORT: process.env.E2E_SERVICE === 'gateway' ? '4000' : '4001',
  SERVICE_NAME: process.env.E2E_SERVICE === 'gateway' ? 'gateway' : 'auth',
  LOG_LEVEL: 'warn',
  OTEL_ENABLED: 'false',
  AUTH_ALLOW_UNVERIFIED_LOGIN: 'false',
  STEP_UP_WINDOW_SECONDS: process.env.STEP_UP_WINDOW_SECONDS ?? '15',
  MFA_RATE_LIMIT_MAX: '5',
  MFA_RATE_LIMIT_WINDOW_SECONDS: '900',
  AUTH_SERVICE_URL: 'http://127.0.0.1:4001',
};

const service = process.env.E2E_SERVICE === 'gateway' ? 'gateway' : 'auth';
const entry = path.join(root, 'services', service, 'dist', 'main.js');
const child = spawn(process.execPath, [entry], {
  cwd: path.join(root, 'services', service),
  env,
  stdio: 'inherit',
});
child.on('exit', (code) => process.exit(code ?? 1));
