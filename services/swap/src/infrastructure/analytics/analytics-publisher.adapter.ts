import { Inject, Injectable, Logger } from '@nestjs/common';
import { ENV, type ServiceEnv } from '../../config/env.schema';

export const ANALYTICS_PUBLISHER = Symbol('ANALYTICS_PUBLISHER');

export interface AnalyticsPublisherPort {
  publishEvent(input: {
    eventType: string;
    aggregateId?: string;
    payload: Record<string, unknown>;
  }): Promise<void>;
}

@Injectable()
export class AnalyticsPublisherAdapter implements AnalyticsPublisherPort {
  private readonly logger = new Logger(AnalyticsPublisherAdapter.name);

  constructor(@Inject(ENV) private readonly env: ServiceEnv) {}

  async publishEvent(input: {
    eventType: string;
    aggregateId?: string;
    payload: Record<string, unknown>;
  }): Promise<void> {
    const baseUrl = this.env.ANALYTICS_SERVICE_URL;
    const apiKey = this.env.INTERNAL_API_KEY;
    if (!baseUrl || !apiKey) return;
    const url = `${baseUrl.replace(/\/$/, '')}/api/v1/internal/analytics/events`;
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-internal-api-key': apiKey },
        body: JSON.stringify({
          eventType: input.eventType,
          domain: 'SWAP',
          aggregateId: input.aggregateId,
          payload: input.payload,
        }),
        signal: AbortSignal.timeout(5_000),
      });
      if (!response.ok) {
        this.logger.warn(`Analytics publish failed HTTP ${response.status}`);
      }
    } catch (error) {
      this.logger.debug(
        `Analytics publish failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}
