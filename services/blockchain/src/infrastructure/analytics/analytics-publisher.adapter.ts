import { Inject, Injectable, Logger } from '@nestjs/common';
import { ENV, type ServiceEnv } from '../../config/env.schema';

export const ANALYTICS_PUBLISHER = Symbol('ANALYTICS_PUBLISHER');

export interface AnalyticsPublishEventInput {
  eventType: string;
  domain: string;
  aggregateId?: string;
  payload: Record<string, unknown>;
  correlationId?: string;
  metrics?: Record<string, number>;
  ownerUserId?: string;
  sourceService?: string;
}

export interface AnalyticsPublisherPort {
  publishEvent(input: AnalyticsPublishEventInput): Promise<void>;
}

const DEFAULT_SOURCE_SERVICE = 'blockchain';

@Injectable()
export class AnalyticsPublisherAdapter implements AnalyticsPublisherPort {
  private readonly logger = new Logger(AnalyticsPublisherAdapter.name);

  constructor(@Inject(ENV) private readonly env: ServiceEnv) {}

  async publishEvent(input: AnalyticsPublishEventInput): Promise<void> {
    const baseUrl = this.env.ANALYTICS_SERVICE_URL;
    const apiKey = this.env.INTERNAL_API_KEY;
    if (!baseUrl || !apiKey) {
      this.logger.debug(`Analytics publisher not configured; skipping event ${input.eventType}`);
      return;
    }

    const body = {
      eventType: input.eventType,
      domain: input.domain,
      aggregateId: input.aggregateId,
      payload: input.payload,
      correlationId: input.correlationId,
      metrics: input.metrics,
      ownerUserId: input.ownerUserId,
      sourceService: input.sourceService ?? DEFAULT_SOURCE_SERVICE,
    };

    const url = `${baseUrl.replace(/\/$/, '')}/api/v1/internal/analytics/events`;
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-internal-api-key': apiKey },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(5_000),
      });
      if (!response.ok) {
        const text = await response.text().catch(() => '');
        this.logger.warn(`Analytics event publish failed HTTP ${response.status}: ${text}`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Analytics event publish failed: ${message}`);
    }
  }
}
