import { Inject, Injectable } from '@nestjs/common';
import type { EmbedResult, ModelRouterPort } from '../../domain';
import { MODEL_ROUTER } from '../ports/provider.tokens';

@Injectable()
export class EmbeddingService {
  constructor(@Inject(MODEL_ROUTER) private readonly router: ModelRouterPort) {}

  async embed(
    input: string[],
    options: { model?: string; providerCode?: string } = {},
  ): Promise<EmbedResult> {
    const provider = await this.router.resolve(options.providerCode);
    return provider.embed({ input, model: options.model });
  }

  async embedOne(
    text: string,
    options: { model?: string; providerCode?: string } = {},
  ): Promise<number[]> {
    const result = await this.embed([text], options);
    return result.vectors[0] ?? [];
  }
}
