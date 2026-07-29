import { Test, type TestingModule } from '@nestjs/testing';
import { HealthStatus } from '@auvora/types';
import { PrismaService } from '@auvora/database';
import { ENV } from '../src/config/env.schema';
import { REDIS_PORT } from '../src/infrastructure/redis/redis.port';
import { HealthController } from '../src/presentation/http/health.controller';

describe('notifications health (e2e)', () => {
  let moduleRef: TestingModule;

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        {
          provide: ENV,
          useValue: {
            SERVICE_NAME: 'notifications',
            SERVICE_VERSION: '0.1.0',
          },
        },
        {
          provide: REDIS_PORT,
          useValue: { ping: async () => true },
        },
        {
          provide: PrismaService,
          useValue: { isHealthy: async () => true },
        },
      ],
    }).compile();
  });

  it('health endpoint returns ok', () => {
    const controller = moduleRef.get(HealthController);
    const health = controller.getHealth();
    expect(health.status).toBe(HealthStatus.Ok);
    expect(health.service).toBe('notifications');
  });

  it('ready endpoint checks dependencies', async () => {
    const controller = moduleRef.get(HealthController);
    const ready = await controller.getReady();
    expect(ready.checks?.database).toBe(HealthStatus.Ok);
    expect(ready.checks?.redis).toBe(HealthStatus.Ok);
    expect(ready.checks?.queueWorker).toBe(HealthStatus.Ok);
  });
});
