import { Controller, Get, Headers, HttpCode, Res, UnauthorizedException } from '@nestjs/common';
import {
  ApiOkResponse,
  ApiServiceUnavailableResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { HealthStatus, type HealthCheckResponse } from '@auvora/types';
import type { Response } from 'express';
import { loadEnv } from '../../config/env.schema';
import {
  getGatewayProxyCircuitStates,
  getGatewayProxyResilienceMetrics,
} from '../../infrastructure/proxy/resilient-proxy';

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
  @ApiServiceUnavailableResponse({
    description: 'Auth dependency unreachable — load balancers should treat as not ready',
  })
  async getReady(@Res({ passthrough: true }) res: Response): Promise<HealthCheckResponse> {
    const authCheck = await this.checkAuthService();
    const ready = authCheck === HealthStatus.Ok;
    const payload: HealthCheckResponse = {
      status: ready ? HealthStatus.Ok : HealthStatus.Degraded,
      service: this.env.SERVICE_NAME,
      version: this.env.SERVICE_VERSION,
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.floor((Date.now() - this.startedAt) / 1000),
      checks: {
        process: HealthStatus.Ok,
        auth: authCheck,
      },
    };
    // Probe-compatible: non-2xx when dependencies are not ready (body still returned).
    res.status(ready ? 200 : 503);
    return payload;
  }

  @Get('metrics/resilience')
  @HttpCode(200)
  @ApiOkResponse({ description: 'Gateway proxy resilience counters (Phase 13)' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid x-internal-api-key when required' })
  getResilienceMetrics(@Headers('x-internal-api-key') internalKey?: string) {
    this.assertResilienceMetricsAccess(internalKey);
    return {
      service: this.env.SERVICE_NAME,
      timestamp: new Date().toISOString(),
      metrics: getGatewayProxyResilienceMetrics(),
      circuits: getGatewayProxyCircuitStates(),
    };
  }

  private assertResilienceMetricsAccess(internalKey?: string): void {
    const configured = this.env.INTERNAL_API_KEY;
    const requireKey = this.env.NODE_ENV === 'production' || Boolean(configured);
    if (!requireKey) return;
    if (!configured || internalKey !== configured) {
      throw new UnauthorizedException(
        'Resilience metrics require a valid x-internal-api-key header',
      );
    }
  }

  private async checkAuthService(): Promise<HealthStatus> {
    const healthUrl = `${this.env.AUTH_SERVICE_URL.replace(/\/$/, '')}/health`;

    try {
      const response = await fetch(healthUrl, { signal: AbortSignal.timeout(2000) });
      return response.ok ? HealthStatus.Ok : HealthStatus.Degraded;
    } catch {
      return HealthStatus.Degraded;
    }
  }
}
