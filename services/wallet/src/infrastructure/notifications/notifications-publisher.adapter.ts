import { Inject, Injectable, Logger } from '@nestjs/common';
import { ENV, type ServiceEnv } from '../../config/env.schema';

export const NOTIFICATIONS_PUBLISHER = Symbol('NOTIFICATIONS_PUBLISHER');

export interface PublishEventInput {
  eventType: string;
  aggregateId?: string;
  payload: Record<string, unknown>;
  correlationId?: string;
}

export interface NotificationsPublisherPort {
  publishEvent(input: PublishEventInput): Promise<void>;
}

/**
 * Thin adapter that forwards a domain "completed" event to the Notification Platform's internal
 * ingestion endpoint (`POST /api/v1/internal/notifications/events`) so it can fan the event out
 * to webhooks/notifications. Intentionally fire-and-forget: a notification-platform outage must
 * never fail the wallet operation that triggered it, so failures are logged, not thrown.
 * No-ops when NOTIFICATIONS_SERVICE_URL/INTERNAL_API_KEY are not configured.
 */
@Injectable()
export class NotificationsPublisherAdapter implements NotificationsPublisherPort {
  private readonly logger = new Logger(NotificationsPublisherAdapter.name);

  constructor(@Inject(ENV) private readonly env: ServiceEnv) {}

  async publishEvent(input: PublishEventInput): Promise<void> {
    const baseUrl = this.env.NOTIFICATIONS_SERVICE_URL;
    const apiKey = this.env.INTERNAL_API_KEY;
    if (!baseUrl || !apiKey) {
      this.logger.debug(`Notifications publisher not configured; skipping event ${input.eventType}`);
      return;
    }

    const url = `${baseUrl.replace(/\/$/, '')}/api/v1/internal/notifications/events`;
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-internal-api-key': apiKey },
        body: JSON.stringify(input),
        signal: AbortSignal.timeout(5_000),
      });
      if (!response.ok) {
        const text = await response.text().catch(() => '');
        this.logger.warn(`Notifications event publish failed HTTP ${response.status}: ${text}`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Notifications event publish failed: ${message}`);
    }
  }
}
