import { Inject, Injectable, Logger } from '@nestjs/common';
import { ENV, type ServiceEnv } from '../../config/env.schema';

export const AI_PUBLISHER = Symbol('AI_PUBLISHER');

export interface AiPublisherPort {
  publish(eventType: string, payload: Record<string, unknown>): Promise<void>;
}

@Injectable()
export class AiPublisherAdapter implements AiPublisherPort {
  private readonly logger = new Logger(AiPublisherAdapter.name);

  constructor(@Inject(ENV) private readonly env: ServiceEnv) {}

  async publish(eventType: string, payload: Record<string, unknown>): Promise<void> {
    if (!this.env.AI_SERVICE_URL || !this.env.INTERNAL_API_KEY) return;
    try {
      await fetch(`${this.env.AI_SERVICE_URL.replace(/\/$/, '')}/api/v1/internal/ai/events`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-internal-api-key': this.env.INTERNAL_API_KEY,
        },
        body: JSON.stringify({ domain: 'STAKING', eventType, payload }),
        signal: AbortSignal.timeout(5_000),
      });
    } catch (error) {
      this.logger.debug(
        `AI publish skipped: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}
