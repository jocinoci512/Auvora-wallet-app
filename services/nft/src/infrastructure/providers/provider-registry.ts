import { Inject, Injectable, Logger } from '@nestjs/common';
import { ChainNetwork } from '@auvora/database';
import { NftProviderError, NftUnsupportedNetworkError } from '../../domain/errors';
import type {
  NftAssetSnapshot,
  NftCollectionSnapshot,
  NftDiscoveryRequest,
  NftDiscoveryResult,
  NftNetworkCapability,
  NftProviderPort,
} from '../../domain/nft-provider.port';
import { ENV, type ServiceEnv } from '../../config/env.schema';
import { AlchemyNftStyleProvider } from './alchemy-nft-style.provider';
import { HeliusStyleProvider } from './helius-style.provider';
import { SimulatorNftProvider } from './simulator-nft.provider';

@Injectable()
export class NftProviderRegistry implements NftProviderPort {
  readonly code = 'registry';
  readonly name = 'NFT Provider Registry';
  private readonly logger = new Logger(NftProviderRegistry.name);
  private readonly providers: NftProviderPort[];

  constructor(
    @Inject(ENV) private readonly env: ServiceEnv,
    @Inject(SimulatorNftProvider) simulator: SimulatorNftProvider,
    @Inject(AlchemyNftStyleProvider) alchemy: AlchemyNftStyleProvider,
    @Inject(HeliusStyleProvider) helius: HeliusStyleProvider,
  ) {
    this.providers = env.NFT_SIMULATOR_ENABLED ? [simulator, alchemy, helius] : [alchemy, helius];
  }

  listProviders(): Array<{ code: string; name: string }> {
    return this.providers.map((p) => ({ code: p.code, name: p.name }));
  }

  getProvider(code: string): NftProviderPort {
    const found = this.providers.find((p) => p.code === code);
    if (!found) throw new NftProviderError(`Unknown NFT provider: ${code}`);
    return found;
  }

  getSupportedNetworks(): NftNetworkCapability[] {
    const map = new Map<ChainNetwork, NftNetworkCapability>();
    for (const provider of this.providers) {
      for (const cap of provider.getSupportedNetworks()) {
        const prev = map.get(cap.network);
        if (!prev || (!prev.nftSupported && cap.nftSupported)) {
          map.set(cap.network, cap);
        } else if (prev && cap.nftSupported) {
          map.set(cap.network, {
            ...prev,
            standards: [...new Set([...prev.standards, ...cap.standards])],
          });
        }
      }
    }
    if (!map.has(ChainNetwork.BITCOIN)) {
      map.set(ChainNetwork.BITCOIN, {
        network: ChainNetwork.BITCOIN,
        nftSupported: false,
        standards: [],
        reason: 'Digital artifact support reserved for future Ordinals/inscription rails',
      });
    }
    return [...map.values()];
  }

  async discoverByOwner(request: NftDiscoveryRequest): Promise<NftDiscoveryResult> {
    const items: NftAssetSnapshot[] = [];
    let latencyMs = 0;
    for (const provider of this.providers) {
      const supported = provider
        .getSupportedNetworks()
        .some((n) => n.network === request.network && n.nftSupported);
      if (!supported) continue;
      try {
        const result = await this.withTimeout(
          () => provider.discoverByOwner(request),
          provider.code,
        );
        latencyMs = Math.max(latencyMs, result.latencyMs);
        for (const item of result.items) {
          const key = `${item.contractAddress}:${item.tokenId}`;
          if (!items.some((i) => `${i.contractAddress}:${i.tokenId}` === key)) {
            items.push(item);
          }
        }
      } catch (error) {
        this.logger.warn(
          `Discover via ${provider.code} failed: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }
    if (
      items.length === 0 &&
      !this.getSupportedNetworks().some((n) => n.network === request.network && n.nftSupported)
    ) {
      throw new NftUnsupportedNetworkError(request.network);
    }
    return { items, nextCursor: null, latencyMs };
  }

  async getAsset(network: ChainNetwork, contractAddress: string, tokenId: string) {
    for (const provider of this.eligible(network)) {
      try {
        const asset = await this.withTimeout(
          () => provider.getAsset(network, contractAddress, tokenId),
          provider.code,
        );
        if (asset) return asset;
      } catch {
        // try next
      }
    }
    return null;
  }

  async verifyOwnership(
    network: ChainNetwork,
    contractAddress: string,
    tokenId: string,
    ownerAddress: string,
  ) {
    for (const provider of this.eligible(network)) {
      try {
        if (
          await this.withTimeout(
            () => provider.verifyOwnership(network, contractAddress, tokenId, ownerAddress),
            provider.code,
          )
        ) {
          return true;
        }
      } catch {
        // try next
      }
    }
    return false;
  }

  async getCollection(network: ChainNetwork, slugOrContract: string) {
    for (const provider of this.eligible(network)) {
      try {
        const collection = await this.withTimeout(
          () => provider.getCollection(network, slugOrContract),
          provider.code,
        );
        if (collection) return collection;
      } catch {
        // try next
      }
    }
    return null;
  }

  async listCollections(network: ChainNetwork): Promise<NftCollectionSnapshot[]> {
    const map = new Map<string, NftCollectionSnapshot>();
    for (const provider of this.eligible(network)) {
      try {
        const list = await this.withTimeout(() => provider.listCollections(network), provider.code);
        for (const collection of list) {
          map.set(collection.slug, collection);
        }
      } catch {
        // try next
      }
    }
    return [...map.values()];
  }

  async refreshMetadata(network: ChainNetwork, contractAddress: string, tokenId: string) {
    for (const provider of this.eligible(network)) {
      try {
        const asset = await this.withTimeout(
          () => provider.refreshMetadata(network, contractAddress, tokenId),
          provider.code,
        );
        if (asset) return asset;
      } catch {
        // try next
      }
    }
    return null;
  }

  async healthCheck() {
    const started = Date.now();
    const results = await Promise.all(
      this.providers.map(async (p) => ({ code: p.code, ...(await p.healthCheck()) })),
    );
    return {
      healthy: results.every((r) => r.healthy),
      latencyMs: Date.now() - started,
      detail: results.map((r) => `${r.code}:${r.healthy ? 'ok' : 'down'}`).join(','),
    };
  }

  private eligible(network: ChainNetwork): NftProviderPort[] {
    return this.providers.filter((p) =>
      p.getSupportedNetworks().some((n) => n.network === network && n.nftSupported),
    );
  }

  private async withTimeout<T>(fn: () => Promise<T>, label: string): Promise<T> {
    let timer: NodeJS.Timeout | undefined;
    try {
      return await Promise.race([
        fn(),
        new Promise<T>((_resolve, reject) => {
          timer = setTimeout(
            () => reject(new NftProviderError(`Provider timeout: ${label}`)),
            this.env.NFT_PROVIDER_TIMEOUT_MS,
          );
        }),
      ]);
    } finally {
      if (timer) clearTimeout(timer);
    }
  }
}
