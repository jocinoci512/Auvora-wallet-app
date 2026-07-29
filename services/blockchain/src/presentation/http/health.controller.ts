import { Controller, Get, Inject, Optional, Param } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { PrismaService } from '@auvora/database';
import { HealthStatus, type HealthCheckResponse } from '@auvora/types';
import { ProviderRpcHealthService } from '../../application/services/provider-rpc-health.service';
import { ENV, type ServiceEnv } from '../../config/env.schema';
import {
  OBSERVABILITY_PUBLISHER,
  type ObservabilityPublisherPort,
} from '../../infrastructure/observability/observability-publisher.adapter';
import { REDIS_PORT, type RedisPort } from '../../infrastructure/redis/redis.port';
import { Public } from '../decorators/auth.decorators';
import { ChainParamDto } from '../dto/address.dto';

// Keep DTO as a runtime value for Nest ValidationPipe + Swagger.
void ChainParamDto;

@ApiTags('health')
@Controller()
export class HealthController {
  private readonly startedAt = Date.now();

  constructor(
    @Inject(ENV) private readonly env: ServiceEnv,
    @Inject(REDIS_PORT) private readonly redis: RedisPort,
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(ProviderRpcHealthService) private readonly providerHealth: ProviderRpcHealthService,
    @Optional()
    @Inject(OBSERVABILITY_PUBLISHER)
    private readonly observability?: ObservabilityPublisherPort,
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

    return {
      status: allHealthy ? HealthStatus.Ok : HealthStatus.Unhealthy,
      service: this.env.SERVICE_NAME,
      version: this.env.SERVICE_VERSION,
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.floor((Date.now() - this.startedAt) / 1000),
      checks,
    };
  }

  @Public()
  @Get('health/providers')
  @ApiOkResponse({ description: 'Live RPC health for every registered chain provider' })
  async getProvidersHealth() {
    const providers = await this.providerHealth.getAll();
    const alchemyConfigured = Boolean(
      this.env.ALCHEMY_API_KEY ||
      this.env.ALCHEMY_ETHEREUM_RPC_URL ||
      this.env.ALCHEMY_BSC_RPC_URL ||
      this.env.ALCHEMY_SOLANA_RPC_URL ||
      this.env.ALCHEMY_TRON_RPC_URL ||
      this.env.ALCHEMY_BITCOIN_RPC_URL,
    );
    return {
      service: this.env.SERVICE_NAME,
      alchemyConfigured,
      timestamp: new Date().toISOString(),
      providers,
    };
  }

  @Public()
  @Get('health/providers/:chain')
  @ApiOkResponse({ description: 'Live RPC health for a single chain provider' })
  async getProviderHealth(@Param() params: ChainParamDto) {
    const provider = await this.providerHealth.getOne(params.chain);
    return {
      service: this.env.SERVICE_NAME,
      timestamp: new Date().toISOString(),
      provider,
    };
  }
}
