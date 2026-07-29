import { Inject, Injectable, Logger } from '@nestjs/common';
import type { ChainNetwork } from '@auvora/database';
import { ENV, type ServiceEnv } from '../../config/env.schema';
import {
  BridgeProviderError,
  BridgeUnsupportedRouteError,
  compareQuotesByOutput,
  compareRoutesByFee,
  type BridgeProviderPort,
  type BridgeProviderQuote,
  type BridgeQuoteRequest,
  type BridgeRoute,
} from '../../domain';
import { LayerZeroStyleProvider } from './layerzero-style.provider';
import { SimulatorBridgeProvider } from './simulator-bridge.provider';
import { WormholeStyleProvider } from './wormhole-style.provider';

@Injectable()
export class BridgeProviderRegistry implements BridgeProviderPort {
  readonly code = 'registry';
  readonly name = 'Bridge Provider Registry';
  readonly priority = 0;
  private readonly logger = new Logger(BridgeProviderRegistry.name);
  private readonly providers: BridgeProviderPort[];

  constructor(
    @Inject(ENV) private readonly env: ServiceEnv,
    @Inject(SimulatorBridgeProvider) simulator: SimulatorBridgeProvider,
    @Inject(LayerZeroStyleProvider) layerZero: LayerZeroStyleProvider,
    @Inject(WormholeStyleProvider) wormhole: WormholeStyleProvider,
  ) {
    this.providers = env.BRIDGE_SIMULATOR_ENABLED
      ? [simulator, layerZero, wormhole]
      : [layerZero, wormhole];
  }

  listProviders() {
    return this.providers
      .map((p) => ({ code: p.code, name: p.name, priority: p.priority }))
      .sort((a, b) => b.priority - a.priority);
  }

  getProvider(code: string): BridgeProviderPort {
    const found = this.providers.find((p) => p.code === code);
    if (!found) throw new BridgeProviderError(`Unknown bridge provider: ${code}`);
    return found;
  }

  getSupportedNetworks() {
    const map = new Map<
      ChainNetwork,
      { network: ChainNetwork; bridgeSupported: boolean; reason?: string }
    >();
    for (const p of this.providers) {
      for (const n of p.getSupportedNetworks()) {
        const prev = map.get(n.network);
        if (!prev || (n.bridgeSupported && !prev.bridgeSupported)) map.set(n.network, n);
      }
    }
    return Array.from(map.values());
  }

  async listRoutes(): Promise<BridgeRoute[]> {
    const merged = new Map<string, BridgeRoute>();
    for (const p of this.providers) {
      try {
        for (const route of await this.withTimeout(() => p.listRoutes())) {
          const key = `${route.providerCode}:${route.routeId}`;
          merged.set(key, route);
        }
      } catch (error) {
        this.logger.warn(
          `listRoutes ${p.code}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }
    return Array.from(merged.values()).sort(compareRoutesByFee);
  }

  async getSupportedAssets(network: ChainNetwork) {
    const primary = this.providers[0]!;
    return this.withTimeout(() => primary.getSupportedAssets(network));
  }

  async getQuote(request: BridgeQuoteRequest): Promise<BridgeProviderQuote> {
    const quotes = await this.collectQuotes(request);
    if (!quotes.length) {
      throw new BridgeUnsupportedRouteError('No providers could quote this route', {
        sourceNetwork: request.sourceNetwork,
        destinationNetwork: request.destinationNetwork,
      });
    }
    return [...quotes].sort(compareQuotesByOutput)[0]!;
  }

  async collectQuotes(request: BridgeQuoteRequest): Promise<BridgeProviderQuote[]> {
    const quotes: BridgeProviderQuote[] = [];
    for (const p of this.providers) {
      try {
        quotes.push(await this.withTimeout(() => p.getQuote(request)));
      } catch (error) {
        this.logger.warn(
          `quote ${p.code}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }
    return quotes;
  }

  prepareTransfer(request: BridgeQuoteRequest & { providerQuoteId: string }) {
    const provider = this.pickByQuoteId(request.providerQuoteId);
    return this.withTimeout(() => provider.prepareTransfer(request));
  }

  executeTransfer(providerQuoteId: string) {
    const provider = this.pickByQuoteId(providerQuoteId);
    return this.withTimeout(() => provider.executeTransfer(providerQuoteId));
  }

  getExecutionStatus(providerRef: string) {
    return this.withTimeout(async () => {
      for (const p of this.providers) {
        try {
          return await p.getExecutionStatus(providerRef);
        } catch {
          /* try next */
        }
      }
      throw new BridgeProviderError('Unknown execution across providers');
    });
  }

  async healthCheck() {
    const started = Date.now();
    const results = await Promise.all(
      this.providers.map(async (p) => ({ code: p.code, ...(await p.healthCheck()) })),
    );
    return {
      healthy: results.some((r) => r.healthy),
      latencyMs: Date.now() - started,
      detail: results.map((r) => `${r.code}:${r.healthy ? 'ok' : 'down'}`).join(','),
    };
  }

  private pickByQuoteId(providerQuoteId: string): BridgeProviderPort {
    if (providerQuoteId.includes('layerzero') || providerQuoteId.startsWith('lz-')) {
      return this.getProvider('layerzero_sim');
    }
    if (providerQuoteId.includes('wormhole') || providerQuoteId.startsWith('wh-')) {
      return this.getProvider('wormhole_sim');
    }
    return this.providers[0]!;
  }

  private async withTimeout<T>(fn: () => Promise<T>): Promise<T> {
    let timer: NodeJS.Timeout | undefined;
    try {
      return await Promise.race([
        fn(),
        new Promise<T>((_, reject) => {
          timer = setTimeout(
            () => reject(new BridgeProviderError('Provider timeout')),
            this.env.BRIDGE_PROVIDER_TIMEOUT_MS,
          );
        }),
      ]);
    } finally {
      if (timer) clearTimeout(timer);
    }
  }
}
