import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { HealthStatus, type HealthCheckResponse } from '@auvora/types';
import { loadEnv } from '../../config/env.schema';

@ApiTags('gateway-health')
@Controller()
export class HealthController {
  private readonly startedAt = Date.now();
  private readonly env = loadEnv();

  @Get('health')
  @ApiOkResponse({ description: 'Gateway liveness probe' })
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
  @ApiOkResponse({ description: 'Gateway readiness probe (includes auth service reachability)' })
  async getReady(): Promise<HealthCheckResponse> {
    const authCheck = await this.checkAuthService();

    return {
      status: authCheck === HealthStatus.Ok ? HealthStatus.Ok : HealthStatus.Degraded,
      service: this.env.SERVICE_NAME,
      version: this.env.SERVICE_VERSION,
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.floor((Date.now() - this.startedAt) / 1000),
      checks: {
        process: HealthStatus.Ok,
        auth: authCheck,
      },
    };
  }

  private async checkAuthService(): Promise<HealthStatus> {
    const healthUrl = `${this.env.AUTH_SERVICE_URL.replace(/\/$/, '')}/health`;

    try {
      const response = await fetch(healthUrl, { signal: AbortSignal.timeout(3_000) });
      return response.ok ? HealthStatus.Ok : HealthStatus.Degraded;
    } catch {
      return HealthStatus.Degraded;
    }
  }
}
