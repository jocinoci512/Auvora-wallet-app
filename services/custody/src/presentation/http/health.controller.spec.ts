import { Test } from '@nestjs/testing';
import { HealthStatus } from '@auvora/types';
import { PrismaService } from '@auvora/database';
import { ENV } from '../../config/env.schema';
import { REDIS_PORT } from '../../infrastructure/redis/redis.port';
import { HealthController } from './health.controller';

describe('HealthController', () => {
  it('returns ok liveness payload', () => {
    const controller = new HealthController(
      { SERVICE_NAME: 'custody', SERVICE_VERSION: '0.1.0' } as never,
      { ping: async () => true } as never,
      { isHealthy: async () => true } as PrismaService,
    );
    const result = controller.getHealth();
    expect(result.status).toBe(HealthStatus.Ok);
    expect(result.service).toBe('custody');
    expect(typeof result.uptimeSeconds).toBe('number');
  });

  it('returns readiness with dependency checks', async () => {
    const controller = new HealthController(
      { SERVICE_NAME: 'custody', SERVICE_VERSION: '0.1.0' } as never,
      { ping: async () => true } as never,
      { isHealthy: async () => true } as PrismaService,
    );
    const result = await controller.getReady();
    expect(result.status).toBe(HealthStatus.Ok);
    expect(result.checks?.database).toBe(HealthStatus.Ok);
    expect(result.checks?.redis).toBe(HealthStatus.Ok);
  });

  it('reports unhealthy when redis is unreachable', async () => {
    const controller = new HealthController(
      { SERVICE_NAME: 'custody', SERVICE_VERSION: '0.1.0' } as never,
      { ping: async () => false } as never,
      { isHealthy: async () => true } as PrismaService,
    );
    const result = await controller.getReady();
    expect(result.status).toBe(HealthStatus.Unhealthy);
    expect(result.checks?.redis).toBe(HealthStatus.Unhealthy);
  });

  it('reports unhealthy when the database is unreachable', async () => {
    const controller = new HealthController(
      { SERVICE_NAME: 'custody', SERVICE_VERSION: '0.1.0' } as never,
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
        { provide: ENV, useValue: { SERVICE_NAME: 'custody', SERVICE_VERSION: '0.1.0' } },
        { provide: REDIS_PORT, useValue: { ping: async () => true } },
        { provide: PrismaService, useValue: { isHealthy: async () => true } },
      ],
    }).compile();

    const controller = moduleRef.get(HealthController);
    expect(controller.getHealth().status).toBe(HealthStatus.Ok);
  });
});
