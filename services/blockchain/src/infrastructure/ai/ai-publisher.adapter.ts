import { Inject, Injectable, Logger } from '@nestjs/common';
import { ENV, type ServiceEnv } from '../../config/env.schema';

export const AI_PUBLISHER = Symbol('AI_PUBLISHER');

export interface AiPublishEventInput {
  eventType: string;
  aggregateId?: string;
  payload: Record<string, unknown>;
  correlationId?: string;
}

export interface AiPublisherPort {
  publishEvent(input: AiPublishEventInput): Promise<void>;
}

/**
 * Thin adapter that forwards a domain "completed" event to the AI Platform's internal
 * ingestion endpoint (`POST /api/v1/internal/ai/events`). Intentionally fire-and-forget:
 * an AI-platform outage must never fail the blockchain operation that triggered it.
 * No-ops when AI_SERVICE_URL/INTERNAL_API_KEY are not configured.
 */
@Injectable()
export class AiPublisherAdapter implements AiPublisherPort {
  private readonly logger = new Logger(AiPublisherAdapter.name);

  constructor(@Inject(ENV) private readonly env: ServiceEnv) {}

  async publishEvent(input: AiPublishEventInput): Promise<void> {
    const baseUrl = this.env.AI_SERVICE_URL;
    const apiKey = this.env.INTERNAL_API_KEY;
    if (!baseUrl || !apiKey) {
      this.logger.debug(`AI publisher not configured; skipping event ${input.eventType}`);
      return;
    }

    const url = `${baseUrl.replace(/\/$/, '')}/api/v1/internal/ai/events`;
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-internal-api-key': apiKey },
        body: JSON.stringify(input),
        signal: AbortSignal.timeout(5_000),
      });
      if (!response.ok) {
        const text = await response.text().catch(() => '');
        this.logger.warn(`AI event publish failed HTTP ${response.status}: ${text}`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`AI event publish failed: ${message}`);
    }
  }
}
