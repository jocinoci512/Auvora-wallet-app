import { Controller, Get, Inject, Optional } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { PrismaService } from '@auvora/database';
import { HealthStatus, type HealthCheckResponse } from '@auvora/types';
import { NftWorkersService } from '../../application/services/nft-workers.service';
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
    @Optional()
    @Inject(NftWorkersService)
    private readonly workers?: NftWorkersService,
  ) {}

  @Public()
  @Get('health')
  @ApiOkResponse({ description: 'Liveness probe' })
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
  @ApiOkResponse({ description: 'Readiness probe' })
  async getReady(): Promise<HealthCheckResponse> {
    const started = Date.now();
    const [dbHealthy, redisHealthy] = await Promise.all([
      this.prisma.isHealthy(),
      this.redis.ping(),
    ]);
    const worker = this.workers?.status();
    const workerHealthy = !worker || !worker.enabled || worker.running;
    const checks: Record<string, HealthStatus> = {
      database: dbHealthy ? HealthStatus.Ok : HealthStatus.Unhealthy,
      redis: redisHealthy ? HealthStatus.Ok : HealthStatus.Unhealthy,
      workers: workerHealthy ? HealthStatus.Ok : HealthStatus.Unhealthy,
    };
    const healthy = Object.values(checks).every((status) => status === HealthStatus.Ok);
    void this.observability?.reportHealth({
      serviceName: this.env.SERVICE_NAME,
      checkName: 'ready',
      status: healthy ? 'HEALTHY' : 'UNHEALTHY',
      latencyMs: Date.now() - started,
      details: checks,
    });
    return {
      status: healthy ? HealthStatus.Ok : HealthStatus.Unhealthy,
      service: this.env.SERVICE_NAME,
      version: this.env.SERVICE_VERSION,
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.floor((Date.now() - this.startedAt) / 1000),
      checks,
    };
  }
}
