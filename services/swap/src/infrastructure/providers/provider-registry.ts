import { Inject, Injectable, Logger } from '@nestjs/common';
import type { ChainNetwork } from '@auvora/database';
import { compareQuotesByOutput } from '../../domain/calculations';
import { SwapProviderError, SwapUnsupportedNetworkError } from '../../domain/errors';
import type {
  PreparedSwapTx,
  SwapAssetRef,
  SwapExecutionStatus,
  SwapNetworkCapability,
  SwapProviderPort,
  SwapProviderQuote,
  SwapProviderRoute,
  SwapQuoteRequest,
} from '../../domain/swap-provider.port';
import { ENV, type ServiceEnv } from '../../config/env.schema';
import { JupiterStyleProvider } from './jupiter-style.provider';
import { SimulatorSwapProvider } from './simulator-swap.provider';
import { ZeroExStyleProvider } from './zeroex-style.provider';

@Injectable()
export class SwapProviderRegistry implements SwapProviderPort {
  readonly code = 'registry';
  readonly name = 'Swap Provider Registry';
  private readonly logger = new Logger(SwapProviderRegistry.name);
  private readonly providers: SwapProviderPort[];

  constructor(
    @Inject(ENV) private readonly env: ServiceEnv,
    @Inject(SimulatorSwapProvider) simulator: SimulatorSwapProvider,
    @Inject(ZeroExStyleProvider) zeroEx: ZeroExStyleProvider,
    @Inject(JupiterStyleProvider) jupiter: JupiterStyleProvider,
  ) {
    this.providers = env.SWAP_SIMULATOR_ENABLED ? [simulator, zeroEx, jupiter] : [zeroEx, jupiter];
  }

  listProviders(): Array<{ code: string; name: string }> {
    return this.providers.map((p) => ({ code: p.code, name: p.name }));
  }

  getProvider(code: string): SwapProviderPort {
    const found = this.providers.find((p) => p.code === code);
    if (!found) throw new SwapProviderError(`Unknown swap provider: ${code}`);
    return found;
  }

  getSupportedNetworks(): SwapNetworkCapability[] {
    const map = new Map<ChainNetwork, SwapNetworkCapability>();
    for (const provider of this.providers) {
      for (const cap of provider.getSupportedNetworks()) {
        const prev = map.get(cap.network);
        if (!prev || (!prev.swapSupported && cap.swapSupported)) {
          map.set(cap.network, cap);
        }
      }
    }
    // Always surface Bitcoin architecture stub
    if (!map.has('BITCOIN' as ChainNetwork)) {
      map.set('BITCOIN' as ChainNetwork, {
        network: 'BITCOIN' as ChainNetwork,
        swapSupported: false,
        reason: 'Direct DEX swaps are not applicable; future OTC/bridge support planned',
      });
    }
    return [...map.values()];
  }

  async getSupportedAssets(network: ChainNetwork): Promise<SwapAssetRef[]> {
    const assets = new Map<string, SwapAssetRef>();
    for (const provider of this.providers) {
      const list = await provider.getSupportedAssets(network);
      for (const asset of list) {
        assets.set(`${asset.symbol}:${asset.contractAddress}`, asset);
      }
    }
    return [...assets.values()];
  }

  async getQuote(request: SwapQuoteRequest): Promise<SwapProviderQuote> {
    const quotes = await this.collectQuotes(request);
    if (quotes.length === 0) {
      throw new SwapUnsupportedNetworkError(request.network, 'No provider returned a quote');
    }
    quotes.sort(compareQuotesByOutput);
    return quotes[0]!;
  }

  async getRoutes(request: SwapQuoteRequest): Promise<SwapProviderRoute[]> {
    const routes: SwapProviderRoute[] = [];
    for (const provider of this.providers) {
      const supported = provider
        .getSupportedNetworks()
        .some((n) => n.network === request.network && n.swapSupported);
      if (!supported) continue;
      try {
        const part = await this.withTimeout(() => provider.getRoutes(request), provider.code);
        routes.push(...part);
      } catch (error) {
        this.logger.warn(
          `Route provider ${provider.code} failed: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }
    return routes.sort((a, b) => compareQuotesByOutput(a, b));
  }

  async buildTransaction(
    request: SwapQuoteRequest & { providerQuoteId: string; providerCode?: string },
  ): Promise<PreparedSwapTx> {
    const code = request.providerCode ?? this.inferProvider(request.providerQuoteId);
    const provider = this.getProvider(code);
    return this.withTimeout(() => provider.buildTransaction(request), provider.code);
  }

  async getExecutionStatus(providerRef: string): Promise<SwapExecutionStatus> {
    for (const provider of this.providers) {
      try {
        return await provider.getExecutionStatus(providerRef);
      } catch {
        // try next
      }
    }
    throw new SwapProviderError('Unable to resolve execution status');
  }

  async healthCheck() {
    const started = Date.now();
    const results = await Promise.all(
      this.providers.map(async (p) => ({ code: p.code, ...(await p.healthCheck()) })),
    );
    const healthy = results.every((r) => r.healthy);
    return {
      healthy,
      latencyMs: Date.now() - started,
      detail: results.map((r) => `${r.code}:${r.healthy ? 'ok' : 'down'}`).join(','),
    };
  }

  async collectQuotes(request: SwapQuoteRequest): Promise<SwapProviderQuote[]> {
    const quotes: SwapProviderQuote[] = [];
    for (const provider of this.providers) {
      const supported = provider
        .getSupportedNetworks()
        .some((n) => n.network === request.network && n.swapSupported);
      if (!supported) continue;
      let attempt = 0;
      while (attempt <= this.env.SWAP_PROVIDER_MAX_RETRIES) {
        try {
          const quote = await this.withTimeout(() => provider.getQuote(request), provider.code);
          quotes.push(quote);
          break;
        } catch (error) {
          attempt += 1;
          if (attempt > this.env.SWAP_PROVIDER_MAX_RETRIES) {
            this.logger.warn(
              `Quote provider ${provider.code} exhausted retries: ${error instanceof Error ? error.message : String(error)}`,
            );
          }
        }
      }
    }
    return quotes;
  }

  private inferProvider(providerQuoteId: string): string {
    if (providerQuoteId.startsWith('0x-')) return 'zeroex_sim';
    if (providerQuoteId.startsWith('jup-')) return 'jupiter_sim';
    return 'simulator';
  }

  private async withTimeout<T>(fn: () => Promise<T>, label: string): Promise<T> {
    let timer: NodeJS.Timeout | undefined;
    try {
      return await Promise.race([
        fn(),
        new Promise<T>((_resolve, reject) => {
          timer = setTimeout(
            () => reject(new SwapProviderError(`Provider timeout: ${label}`)),
            this.env.SWAP_PROVIDER_TIMEOUT_MS,
          );
        }),
      ]);
    } finally {
      if (timer) clearTimeout(timer);
    }
  }
}
