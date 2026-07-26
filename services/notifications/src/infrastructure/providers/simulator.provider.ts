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
 * Local development/test channel backend. Logs delivery attempts to the console instead of
 * dispatching to a real email/SMS/push/webhook provider. Never reaches an external network.
 */
export class SimulatorChannelProvider implements ChannelProviderPort {
  private readonly logger: Logger;

  constructor(private readonly channel: NotificationChannelCode) {
    this.logger = new Logger(`Simulator:${channel}`);
  }

  getCode(): string {
    return `simulator-${this.channel.toLowerCase()}`;
  }

  getChannel(): NotificationChannelCode {
    return this.channel;
  }

  async send(input: ChannelSendRequest): Promise<ChannelSendResult> {
    const startedAt = Date.now();
    this.logger.log(
      `SIMULATED DELIVERY -> recipient=${input.recipient} subject=${input.subject ?? '(none)'} body=${input.body.slice(0, 200)}`,
    );
    return Promise.resolve({
      providerCode: this.getCode(),
      success: true,
      providerRef: `sim-${randomUUID()}`,
      latencyMs: Date.now() - startedAt,
    });
  }

  async health(): Promise<ChannelHealthResult> {
    return Promise.resolve({ healthy: true, providerCode: this.getCode(), checkedAt: new Date() });
  }
}
