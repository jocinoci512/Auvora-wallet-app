process.env.NODE_ENV = process.env.NODE_ENV ?? 'test';
process.env.SERVICE_NAME = 'staking';
process.env.PORT = process.env.PORT ?? '3015';
process.env.DATABASE_URL =
  process.env.DATABASE_URL ?? 'postgresql://test:test@localhost:5432/auvora_test';
process.env.REDIS_URL = process.env.REDIS_URL ?? 'redis://localhost:6379';
process.env.JWT_ACCESS_SECRET =
  process.env.JWT_ACCESS_SECRET ?? 'test-access-secret-minimum-32-characters-long';
process.env.CSRF_SECRET = process.env.CSRF_SECRET ?? 'test-csrf-secret-minimum-32-characters-long';
process.env.INTERNAL_API_KEY =
  process.env.INTERNAL_API_KEY ?? 'test-internal-api-key-minimum-32-characters';
process.env.STAKING_FIELD_ENCRYPTION_KEY =
  process.env.STAKING_FIELD_ENCRYPTION_KEY ?? 'test-staking-field-encryption-key-32ch!!';
process.env.OTEL_ENABLED = process.env.OTEL_ENABLED ?? 'false';
process.env.LOG_LEVEL = process.env.LOG_LEVEL ?? 'silent';
process.env.STAKING_WORKERS_ENABLED = process.env.STAKING_WORKERS_ENABLED ?? 'false';
process.env.STAKING_SIMULATOR_ENABLED = process.env.STAKING_SIMULATOR_ENABLED ?? 'true';
