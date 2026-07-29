import { Inject, Injectable } from '@nestjs/common';
import { ChainNetwork } from '@auvora/database';
import { NftUnsupportedNetworkError } from '../../domain/errors';
import type {
  NftCollectionSnapshot,
  NftDiscoveryRequest,
  NftDiscoveryResult,
  NftNetworkCapability,
  NftProviderPort,
} from '../../domain/nft-provider.port';
import { SimulatorNftProvider } from './simulator-nft.provider';

/** Solana-focused secondary NFT indexer (simulated Helius-style). */
@Injectable()
export class HeliusStyleProvider implements NftProviderPort {
  readonly code = 'helius_sim';
  readonly name = 'Helius-style NFT Indexer (sim)';

  constructor(@Inject(SimulatorNftProvider) private readonly simulator: SimulatorNftProvider) {}

  getSupportedNetworks(): NftNetworkCapability[] {
    return [
      { network: ChainNetwork.SOLANA, nftSupported: true, standards: ['SPL'] },
      { network: ChainNetwork.ETHEREUM, nftSupported: false, standards: [], reason: 'Solana-only' },
      {
        network: ChainNetwork.BNB_SMART_CHAIN,
        nftSupported: false,
        standards: [],
        reason: 'Solana-only',
      },
      { network: ChainNetwork.TRON, nftSupported: false, standards: [], reason: 'Solana-only' },
      { network: ChainNetwork.BITCOIN, nftSupported: false, standards: [], reason: 'Solana-only' },
    ];
  }

  async discoverByOwner(request: NftDiscoveryRequest): Promise<NftDiscoveryResult> {
    if (request.network !== ChainNetwork.SOLANA) {
      throw new NftUnsupportedNetworkError(request.network, 'helius_sim supports Solana only');
    }
    return this.simulator.discoverByOwner(request);
  }

  async getAsset(network: ChainNetwork, contractAddress: string, tokenId: string) {
    if (network !== ChainNetwork.SOLANA) {
      throw new NftUnsupportedNetworkError(network, 'helius_sim supports Solana only');
    }
    return this.simulator.getAsset(network, contractAddress, tokenId);
  }

  async verifyOwnership(
    network: ChainNetwork,
    contractAddress: string,
    tokenId: string,
    ownerAddress: string,
  ) {
    if (network !== ChainNetwork.SOLANA) return false;
    return this.simulator.verifyOwnership(network, contractAddress, tokenId, ownerAddress);
  }

  async getCollection(network: ChainNetwork, slugOrContract: string) {
    if (network !== ChainNetwork.SOLANA) {
      throw new NftUnsupportedNetworkError(network, 'helius_sim supports Solana only');
    }
    return this.simulator.getCollection(network, slugOrContract);
  }

  async listCollections(network: ChainNetwork): Promise<NftCollectionSnapshot[]> {
    if (network !== ChainNetwork.SOLANA) return [];
    return this.simulator.listCollections(network);
  }

  async refreshMetadata(network: ChainNetwork, contractAddress: string, tokenId: string) {
    if (network !== ChainNetwork.SOLANA) {
      throw new NftUnsupportedNetworkError(network, 'helius_sim supports Solana only');
    }
    return this.simulator.refreshMetadata(network, contractAddress, tokenId);
  }

  async healthCheck() {
    return { healthy: true, latencyMs: 3, detail: 'helius_sim ok' };
  }
}
