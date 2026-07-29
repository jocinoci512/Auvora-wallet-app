import { Inject, Injectable, Logger } from '@nestjs/common';
import { ENV, type ServiceEnv } from '../../config/env.schema';

export const OBSERVABILITY_PUBLISHER = Symbol('OBSERVABILITY_PUBLISHER');

export interface ObservabilityHealthInput {
  serviceName: string;
  checkName: string;
  status: 'HEALTHY' | 'DEGRADED' | 'UNHEALTHY' | 'UNKNOWN';
  latencyMs?: number;
  details?: Record<string, unknown>;
}

export interface ObservabilityMetricInput {
  code: string;
  domain: string;
  serviceName: string;
  value: number;
  name?: string;
  unit?: string;
  correlationId?: string;
  labels?: Record<string, unknown>;
}

export interface ObservabilityPublisherPort {
  reportHealth(input: ObservabilityHealthInput): Promise<void>;
  reportMetric(input: ObservabilityMetricInput): Promise<void>;
}

@Injectable()
export class ObservabilityPublisherAdapter implements ObservabilityPublisherPort {
  private readonly logger = new Logger(ObservabilityPublisherAdapter.name);

  constructor(@Inject(ENV) private readonly env: ServiceEnv) {}

  async reportHealth(input: ObservabilityHealthInput): Promise<void> {
    await this.post('/api/v1/internal/observability/health', input);
  }

  async reportMetric(input: ObservabilityMetricInput): Promise<void> {
    await this.post('/api/v1/internal/observability/metrics', { samples: [input] });
  }

  private async post(path: string, body: unknown): Promise<void> {
    const baseUrl = (this.env as { OBSERVABILITY_SERVICE_URL?: string }).OBSERVABILITY_SERVICE_URL;
    const apiKey = this.env.INTERNAL_API_KEY;
    if (!baseUrl || !apiKey) {
      this.logger.debug(`Observability publisher not configured; skipping ${path}`);
      return;
    }
    const url = `${baseUrl.replace(/\/$/, '')}${path}`;
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-internal-api-key': apiKey },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(5_000),
      });
      if (!response.ok) {
        const text = await response.text().catch(() => '');
        this.logger.warn(`Observability publish failed HTTP ${response.status}: ${text}`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Observability publish failed: ${message}`);
    }
  }
}
