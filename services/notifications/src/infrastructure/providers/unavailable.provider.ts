import type {
  ChannelHealthResult,
  ChannelProviderPort,
  ChannelSendRequest,
  ChannelSendResult,
  NotificationChannelCode,
} from '../../domain';
import { ProviderUnavailableError } from '../../domain';

/** Used when no simulator/real backend is configured for a channel — fails closed for sends. */
export class UnavailableChannelProvider implements ChannelProviderPort {
  constructor(private readonly channel: NotificationChannelCode) {}

  getCode(): string {
    return `unavailable-${this.channel.toLowerCase()}`;
  }

  getChannel(): NotificationChannelCode {
    return this.channel;
  }

  async send(_input: ChannelSendRequest): Promise<ChannelSendResult> {
    void _input;
    throw new ProviderUnavailableError(`No provider configured for channel ${this.channel}`);
  }

  async health(): Promise<ChannelHealthResult> {
    return Promise.resolve({
      healthy: false,
      providerCode: this.getCode(),
      checkedAt: new Date(),
      details: 'No provider configured',
    });
  }
}
