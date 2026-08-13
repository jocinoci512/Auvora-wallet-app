import { Controller, Get, Inject, Optional, Res } from '@nestjs/common';
import { ApiOkResponse, ApiServiceUnavailableResponse, ApiTags } from '@nestjs/swagger';
import { PrismaService } from '@auvora/database';
import { HealthStatus, type HealthCheckResponse } from '@auvora/types';
import type { Response } from 'express';
import { ENV, type ServiceEnv } from '../../config/env.schema';
import {
  OBSERVABILITY_PUBLISHER,
  type ObservabilityPublisherPort,
} from '../../infrastructure/observability/observability-publisher.adapter';
import { REDIS_PORT, type RedisPort } from '../../infrastructure/redis/redis.port';
import { Public } from '../decorators/auth.decorators';

@ApiTags('health')
@Controller()
export class HealthController {
  private readonly startedAt = Date.now();

  constructor(
    @Inject(ENV) private readonly env: ServiceEnv,
    @Inject(REDIS_PORT) private readonly redis: RedisPort,
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Optional()
    @Inject(OBSERVABILITY_PUBLISHER)
    private readonly observability?: ObservabilityPublisherPort,
  ) {}

  @Public()
  @Get('health')
  @ApiOkResponse({ description: 'Liveness probe — process up; no Postgres/Redis/Blockchain' })
  getHealth(): HealthCheckResponse {
    return {
      status: HealthStatus.Ok,
      service: this.env.SERVICE_NAME,
      version: this.env.SERVICE_VERSION,
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.floor((Date.now() - this.startedAt) / 1000),
    };
  }

  @Public()
  @Get('ready')
  @ApiOkResponse({ description: 'Readiness probe — Postgres + Redis' })
  @ApiServiceUnavailableResponse({ description: 'Postgres or Redis unhealthy' })
  async getReady(@Res({ passthrough: true }) res: Response): Promise<HealthCheckResponse> {
    const started = Date.now();
    const [dbHealthy, redisHealthy] = await Promise.all([
      this.prisma.isHealthy(),
      this.redis.ping(),
    ]);

    const checks: Record<string, HealthStatus> = {
      database: dbHealthy ? HealthStatus.Ok : HealthStatus.Unhealthy,
      redis: redisHealthy ? HealthStatus.Ok : HealthStatus.Unhealthy,
      process: HealthStatus.Ok,
    };

    const allHealthy = dbHealthy && redisHealthy;
    void this.observability?.reportHealth({
      serviceName: this.env.SERVICE_NAME,
      checkName: 'ready',
      status: allHealthy ? 'HEALTHY' : 'UNHEALTHY',
      latencyMs: Date.now() - started,
      details: checks,
    });

    res.status(allHealthy ? 200 : 503);

    return {
      status: allHealthy ? HealthStatus.Ok : HealthStatus.Unhealthy,
      service: this.env.SERVICE_NAME,
      version: this.env.SERVICE_VERSION,
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.floor((Date.now() - this.startedAt) / 1000),
      checks,
    };
  }
}
