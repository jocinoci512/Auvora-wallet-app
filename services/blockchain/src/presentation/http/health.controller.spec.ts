import { HealthStatus } from '@auvora/types';
import { PrismaService } from '@auvora/database';
import { Test } from '@nestjs/testing';
import type { Response } from 'express';
import { ProviderRpcHealthService } from '../../application/services/provider-rpc-health.service';
import { ENV } from '../../config/env.schema';
import { REDIS_PORT } from '../../infrastructure/redis/redis.port';
import { HealthController } from './health.controller';

const providerHealthStub = {
  getAll: async () => [],
  getOne: async () => ({
    chain: 'ETHEREUM',
    status: 'up',
    backend: 'simulator',
    latencyMs: 1,
    latestBlockHeight: '1',
    synchronized: true,
    lastSuccessfulRpc: new Date().toISOString(),
    endpoint: null,
  }),
};

function mockRes(): Response {
  return { status: jest.fn().mockReturnThis() } as unknown as Response;
}

describe('HealthController', () => {
  it('returns ok liveness payload', () => {
    const controller = new HealthController(
      {
        SERVICE_NAME: 'blockchain',
        SERVICE_VERSION: '0.1.0',
      } as never,
      { ping: async () => true },
      { isHealthy: async () => true } as PrismaService,
      providerHealthStub as never,
    );
    const result = controller.getHealth();
    expect(result.status).toBe(HealthStatus.Ok);
    expect(result.service).toBe('blockchain');
    expect(typeof result.uptimeSeconds).toBe('number');
  });

  it('returns readiness with dependency checks and HTTP 200', async () => {
    const res = mockRes();
    const controller = new HealthController(
      {
        SERVICE_NAME: 'blockchain',
        SERVICE_VERSION: '0.1.0',
      } as never,
      { ping: async () => true },
      { isHealthy: async () => true } as PrismaService,
      providerHealthStub as never,
    );
    const result = await controller.getReady(res);
    expect(result.status).toBe(HealthStatus.Ok);
    expect(result.checks?.database).toBe(HealthStatus.Ok);
    expect(result.checks?.redis).toBe(HealthStatus.Ok);
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('reports unhealthy with HTTP 503 when a dependency check fails', async () => {
    const res = mockRes();
    const controller = new HealthController(
      {
        SERVICE_NAME: 'blockchain',
        SERVICE_VERSION: '0.1.0',
      } as never,
      { ping: async () => false },
      { isHealthy: async () => true } as PrismaService,
      providerHealthStub as never,
    );
    const result = await controller.getReady(res);
    expect(result.status).toBe(HealthStatus.Unhealthy);
    expect(result.checks?.redis).toBe(HealthStatus.Unhealthy);
    expect(res.status).toHaveBeenCalledWith(503);
  });

  it('works via Nest testing module', async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        {
          provide: ENV,
          useValue: { SERVICE_NAME: 'blockchain', SERVICE_VERSION: '0.1.0' },
        },
        {
          provide: REDIS_PORT,
          useValue: { ping: async () => true },
        },
        {
          provide: PrismaService,
          useValue: { isHealthy: async () => true },
        },
        {
          provide: ProviderRpcHealthService,
          useValue: providerHealthStub,
        },
      ],
    }).compile();

    const controller = moduleRef.get(HealthController);
    expect(controller.getHealth().status).toBe(HealthStatus.Ok);
    await moduleRef.close();
  });
});
