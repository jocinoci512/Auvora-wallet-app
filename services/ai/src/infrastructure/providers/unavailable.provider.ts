import type {
  AiProviderPort,
  AiProviderTypeCode,
  ChatRequest,
  ChatResult,
  EmbedRequest,
  EmbedResult,
  ProviderHealthResult,
} from '../../domain';
import { ProviderUnavailableError } from '../../domain';

/** Used when a provider is enabled in the DB but has no usable credentials/URL configured — fails closed. */
export class UnavailableAiProvider implements AiProviderPort {
  constructor(
    readonly code: string,
    readonly type: AiProviderTypeCode,
  ) {}

  async chat(_request: ChatRequest): Promise<ChatResult> {
    void _request;
    throw new ProviderUnavailableError(`Provider ${this.code} is not configured`);
  }

  async embed(_request: EmbedRequest): Promise<EmbedResult> {
    void _request;
    throw new ProviderUnavailableError(`Provider ${this.code} is not configured`);
  }

  async health(): Promise<ProviderHealthResult> {
    return Promise.resolve({
      healthy: false,
      providerCode: this.code,
      checkedAt: new Date(),
      details: 'No credentials configured',
    });
  }
}
