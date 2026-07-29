import { Inject, Injectable } from '@nestjs/common';
import { ChainNetwork } from '@auvora/database';
import { compareQuotesByOutput } from '../../domain/calculations';
import { SWAP_PROVIDER, type SwapProviderPort, type SwapQuoteRequest } from '../../domain';
import { SwapProviderRegistry } from '../../infrastructure/providers/provider-registry';

@Injectable()
export class RoutingEngineService {
  constructor(
    @Inject(SWAP_PROVIDER) private readonly providers: SwapProviderPort,
    @Inject(SwapProviderRegistry) private readonly registry: SwapProviderRegistry,
  ) {}

  async compareRoutes(request: SwapQuoteRequest) {
    if (request.network === ChainNetwork.BITCOIN) {
      return {
        network: request.network,
        supported: false,
        architecture: 'future_otc_or_bridge',
        routes: [],
        bestRoute: null,
        message:
          'Direct DEX swaps are not applicable on Bitcoin. Architecture reserved for OTC/bridge rails.',
      };
    }
    const routes = await this.registry.getRoutes(request);
    const sorted = [...routes].sort(compareQuotesByOutput);
    return {
      network: request.network,
      supported: true,
      architecture: 'dex_aggregator',
      routes: sorted,
      bestRoute: sorted[0] ?? null,
      message: sorted.length ? 'Routes compared across providers' : 'No routes available',
    };
  }

  async bestQuote(request: SwapQuoteRequest) {
    return this.providers.getQuote(request);
  }
}
