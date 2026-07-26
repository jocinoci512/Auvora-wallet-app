import { randomUUID } from 'node:crypto';
import { Logger } from '@nestjs/common';
import type {
  ChannelHealthResult,
  ChannelProviderPort,
  ChannelSendRequest,
  ChannelSendResult,
  NotificationChannelCode,
} from '../../domain';

/**
 * Platform-owned delivery for IN_APP and BROWSER (and WEBHOOK, which already fans out via
 * `WebhookService`). There is no external network hop: the notification row itself is the
 * delivery, so this always marks success once persisted. Used outside of the simulator when no
 * external backend applies to the channel.
 */
export class LocalInAppProvider implements ChannelProviderPort {
  private readonly logger: Logger;

  constructor(private readonly channel: NotificationChannelCode) {
    this.logger = new Logger(`LocalInApp:${channel}`);
  }

  getCode(): string {
    return `local-${this.channel.toLowerCase()}`;
  }

  getChannel(): NotificationChannelCode {
    return this.channel;
  }

  async send(input: ChannelSendRequest): Promise<ChannelSendResult> {
    const startedAt = Date.now();
    this.logger.log(`IN-PLATFORM DELIVERY -> notificationId=${input.notificationId} recipient=${input.recipient}`);
    return Promise.resolve({
      providerCode: this.getCode(),
      success: true,
      providerRef: `local-${randomUUID()}`,
      latencyMs: Date.now() - startedAt,
    });
  }

  async health(): Promise<ChannelHealthResult> {
    return Promise.resolve({ healthy: true, providerCode: this.getCode(), checkedAt: new Date() });
  }
}
