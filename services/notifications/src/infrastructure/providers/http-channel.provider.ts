import { randomUUID } from 'node:crypto';
import { Logger } from '@nestjs/common';
import type {
  ChannelHealthResult,
  ChannelProviderPort,
  ChannelSendRequest,
  ChannelSendResult,
  NotificationChannelCode,
} from '../../domain';

export interface HttpChannelProviderConfig {
  url: string;
  token?: string;
  timeoutMs?: number;
}

type FetchLike = (
  input: string,
  init: { method: string; headers: Record<string, string>; body: string; signal?: AbortSignal },
) => Promise<{ ok: boolean; status: number; text(): Promise<string> }>;

/**
 * Dispatches a channel delivery to an externally configured HTTP endpoint (ESP, SMS gateway,
 * push gateway, Slack/Teams incoming webhook, etc). The URL and optional bearer token come
 * exclusively from environment configuration — never from user/DB input — so this provider can
 * only ever call destinations an operator has explicitly configured.
 */
export class HttpChannelProvider implements ChannelProviderPort {
  private readonly logger: Logger;

  constructor(
    private readonly channel: NotificationChannelCode,
    private readonly config: HttpChannelProviderConfig,
  ) {
    this.logger = new Logger(`Http:${channel}`);
  }

  private get fetchImpl(): FetchLike {
    return globalThis.fetch.bind(globalThis) as unknown as FetchLike;
  }

  getCode(): string {
    return `http-${this.channel.toLowerCase()}`;
  }

  getChannel(): NotificationChannelCode {
    return this.channel;
  }

  async send(input: ChannelSendRequest): Promise<ChannelSendResult> {
    const startedAt = Date.now();
    try {
      const response = await this.fetchImpl(this.config.url, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...(this.config.token ? { authorization: `Bearer ${this.config.token}` } : {}),
        },
        body: JSON.stringify({
          notificationId: input.notificationId,
          recipient: input.recipient,
          subject: input.subject,
          body: input.body,
          metadata: input.metadata,
        }),
        signal: AbortSignal.timeout(this.config.timeoutMs ?? 8_000),
      });
      const latencyMs = Date.now() - startedAt;

      if (!response.ok) {
        const text = await response.text().catch(() => '');
        return {
          providerCode: this.getCode(),
          success: false,
          latencyMs,
          errorMessage: `HTTP ${response.status}: ${text.slice(0, 500)}`,
        };
      }

      return {
        providerCode: this.getCode(),
        success: true,
        providerRef: `${this.getCode()}-${randomUUID()}`,
        latencyMs,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Delivery to ${this.channel} provider failed: ${message}`);
      return {
        providerCode: this.getCode(),
        success: false,
        latencyMs: Date.now() - startedAt,
        errorMessage: message,
      };
    }
  }

  async health(): Promise<ChannelHealthResult> {
    return Promise.resolve({
      healthy: true,
      providerCode: this.getCode(),
      checkedAt: new Date(),
      details: `configured: ${this.config.url}`,
    });
  }
}
