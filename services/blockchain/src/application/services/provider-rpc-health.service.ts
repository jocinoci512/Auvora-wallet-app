import { Inject, Injectable, Logger } from '@nestjs/common';
import type { ChainNetwork } from '@auvora/database';
import { PROVIDER_FACTORY, type ProviderFactoryPort } from '../ports/provider-factory.port';
import type { BlockchainProvider } from '../../domain';
import { NotFoundError } from '../../domain';
import type { JsonRpcMetrics } from '../../infrastructure/providers/alchemy/json-rpc.client';

export type ProviderBackend = 'alchemy' | 'simulator';

export type ProviderRpcHealth = {
  chain: ChainNetwork;
  status: 'up' | 'down' | 'degraded';
  backend: ProviderBackend;
  latencyMs: number;
  latestBlockHeight: string | null;
  synchronized: boolean;
  lastSuccessfulRpc: string | null;
  endpoint: string | null;
  message?: string;
  metrics?: JsonRpcMetrics;
};

function isAlchemyLive(
  provider: BlockchainProvider,
): provider is BlockchainProvider & {
  getRpcMetrics(): JsonRpcMetrics;
  getSafeEndpoint(): string;
} {
  return (
    typeof (provider as { getRpcMetrics?: unknown }).getRpcMetrics === 'function' &&
    typeof (provider as { getSafeEndpoint?: unknown }).getSafeEndpoint === 'function'
  );
}

@Injectable()
export class ProviderRpcHealthService {
  private readonly logger = new Logger(ProviderRpcHealthService.name);

  constructor(@Inject(PROVIDER_FACTORY) private readonly providers: ProviderFactoryPort) {}

  async getAll(): Promise<ProviderRpcHealth[]> {
    const chains = this.providers.getSupportedChains();
    const results = await Promise.all(chains.map((chain) => this.probe(chain)));
    return results;
  }

  async getOne(chain: ChainNetwork): Promise<ProviderRpcHealth> {
    if (!this.providers.hasProvider(chain)) {
      throw new NotFoundError(`No provider registered for chain ${chain}`);
    }
    return this.probe(chain);
  }

  private async probe(chain: ChainNetwork): Promise<ProviderRpcHealth> {
    const provider = this.providers.getProvider(chain);
    const backend: ProviderBackend = isAlchemyLive(provider) ? 'alchemy' : 'simulator';
    const endpoint = isAlchemyLive(provider) ? provider.getSafeEndpoint() : null;
    const metrics = isAlchemyLive(provider) ? provider.getRpcMetrics() : undefined;

    try {
      const health = await provider.healthCheck();
      let latestBlockHeight: string | null = null;
      let synchronized = false;
      try {
        const tip = await provider.getBlockHeight();
        latestBlockHeight = tip.toString();
        synchronized = tip > 0n;
      } catch {
        synchronized = false;
      }

      const status: ProviderRpcHealth['status'] = !health.healthy
        ? 'down'
        : !synchronized
          ? 'degraded'
          : 'up';

      if (status !== 'up') {
        this.logger.warn(`Provider health ${chain} status=${status} backend=${backend}`);
      }

      return {
        chain,
        status,
        backend,
        latencyMs: health.latencyMs,
        latestBlockHeight,
        synchronized,
        lastSuccessfulRpc: metrics?.lastSuccessAt ?? (health.healthy ? new Date().toISOString() : null),
        endpoint,
        message: health.message,
        metrics,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message.slice(0, 200) : 'probe_failed';
      this.logger.error(`Provider health probe failed chain=${chain} backend=${backend}: ${message}`);
      return {
        chain,
        status: 'down',
        backend,
        latencyMs: 0,
        latestBlockHeight: null,
        synchronized: false,
        lastSuccessfulRpc: metrics?.lastSuccessAt ?? null,
        endpoint,
        message,
        metrics,
      };
    }
  }
}
