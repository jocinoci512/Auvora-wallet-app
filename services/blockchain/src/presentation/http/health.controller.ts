import { Controller, Get, Inject } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { PrismaService } from '@auvora/database';
import { HealthStatus, type HealthCheckResponse } from '@auvora/types';
import { ENV, type ServiceEnv } from '../../config/env.schema';
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
