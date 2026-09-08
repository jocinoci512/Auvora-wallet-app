import { Test } from '@nestjs/testing';
import { HealthStatus } from '@auvora/types';
import { PrismaService } from '@auvora/database';
import { ENV } from '../../config/env.schema';
import { REDIS_PORT } from '../../infrastructure/redis/redis.port';
import { HealthController } from './health.controller';

describe('HealthController', () => {
  it('returns ok liveness payload', () => {
    const controller = new HealthController(
      { SERVICE_NAME: 'compliance', SERVICE_VERSION: '0.1.0' } as never,
      { ping: async () => true } as never,
      { isHealthy: async () => true } as PrismaService,
    );
    const result = controller.getHealth();
    expect(result.status).toBe(HealthStatus.Ok);
    expect(result.service).toBe('compliance');
    expect(typeof result.uptimeSeconds).toBe('number');
  });

  it('returns readiness with dependency checks when kycProvider is configured', async () => {
    const controller = new HealthController(
      {
        SERVICE_NAME: 'compliance',
        SERVICE_VERSION: '0.1.0',
        KYC_PROVIDER_API_KEY: 'sk_test_123',
      } as never,
      { ping: async () => true } as never,
      { isHealthy: async () => true } as PrismaService,
    );
    const result = await controller.getReady();
    expect(result.status).toBe(HealthStatus.Ok);
    expect(result.checks?.database).toBe(HealthStatus.Ok);
    expect(result.checks?.redis).toBe(HealthStatus.Ok);
    expect(result.checks?.kycProvider).toBe(HealthStatus.Ok);
  });

  it('returns ok readiness when KYC_MODE is manual_admin_review without external API key', async () => {
    const controller = new HealthController(
      {
        SERVICE_NAME: 'compliance',
        SERVICE_VERSION: '0.1.0',
        KYC_MODE: 'manual_admin_review',
      } as never,
      { ping: async () => true } as never,
      { isHealthy: async () => true } as PrismaService,
    );
    const result = await controller.getReady();
    expect(result.status).toBe(HealthStatus.Ok);
    expect(result.checks?.database).toBe(HealthStatus.Ok);
    expect(result.checks?.redis).toBe(HealthStatus.Ok);
    expect(result.checks?.kycProvider).toBe(HealthStatus.Ok);
  });

  it('returns degraded readiness when KYC_MODE is commercial_provider and API key is unconfigured', async () => {
    const controller = new HealthController(
      {
        SERVICE_NAME: 'compliance',
        SERVICE_VERSION: '0.1.0',
        KYC_MODE: 'commercial_provider',
      } as never,
      { ping: async () => true } as never,
      { isHealthy: async () => true } as PrismaService,
    );
    const result = await controller.getReady();
    expect(result.status).toBe(HealthStatus.Degraded);
    expect(result.checks?.database).toBe(HealthStatus.Ok);
    expect(result.checks?.redis).toBe(HealthStatus.Ok);
    expect(result.checks?.kycProvider).toBe(HealthStatus.Degraded);
  });

  it('reports unhealthy when redis is unreachable', async () => {
    const controller = new HealthController(
      { SERVICE_NAME: 'compliance', SERVICE_VERSION: '0.1.0' } as never,
      { ping: async () => false } as never,
      { isHealthy: async () => true } as PrismaService,
    );
    const result = await controller.getReady();
    expect(result.status).toBe(HealthStatus.Unhealthy);
    expect(result.checks?.redis).toBe(HealthStatus.Unhealthy);
  });

  it('reports unhealthy when the database is unreachable', async () => {
    const controller = new HealthController(
      { SERVICE_NAME: 'compliance', SERVICE_VERSION: '0.1.0' } as never,
      { ping: async () => true } as never,
      { isHealthy: async () => false } as PrismaService,
    );
    const result = await controller.getReady();
    expect(result.status).toBe(HealthStatus.Unhealthy);
    expect(result.checks?.database).toBe(HealthStatus.Unhealthy);
  });

  it('works via Nest testing module', async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        { provide: ENV, useValue: { SERVICE_NAME: 'compliance', SERVICE_VERSION: '0.1.0' } },
        { provide: REDIS_PORT, useValue: { ping: async () => true } },
        { provide: PrismaService, useValue: { isHealthy: async () => true } },
      ],
    }).compile();

    const controller = moduleRef.get(HealthController);
    expect(controller.getHealth().status).toBe(HealthStatus.Ok);
    await moduleRef.close();
  });
});
