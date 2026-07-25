import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { HealthStatus, type HealthCheckResponse } from '@auvora/types';
import { loadEnv } from '../../config/env.schema';

@ApiTags('health')
@Controller()
export class HealthController {
  private readonly startedAt = Date.now();
  private readonly env = loadEnv();

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

  @Get('ready')
  @ApiOkResponse({ description: 'Readiness probe' })
  getReady(): HealthCheckResponse {
    return {
      status: HealthStatus.Ok,
      service: this.env.SERVICE_NAME,
      version: this.env.SERVICE_VERSION,
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.floor((Date.now() - this.startedAt) / 1000),
      checks: {
        process: HealthStatus.Ok,
      },
    };
  }
}
