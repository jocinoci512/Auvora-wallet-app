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

/** EVM-focused secondary NFT indexer (simulated Alchemy NFT API style). */
@Injectable()
export class AlchemyNftStyleProvider implements NftProviderPort {
  readonly code = 'alchemy_nft_sim';
  readonly name = 'Alchemy NFT-style Indexer (sim)';

  constructor(@Inject(SimulatorNftProvider) private readonly simulator: SimulatorNftProvider) {}

  getSupportedNetworks(): NftNetworkCapability[] {
    return [
      { network: ChainNetwork.ETHEREUM, nftSupported: true, standards: ['ERC721', 'ERC1155'] },
      {
        network: ChainNetwork.BNB_SMART_CHAIN,
        nftSupported: true,
        standards: ['BEP721', 'BEP1155'],
      },
      { network: ChainNetwork.SOLANA, nftSupported: false, standards: [], reason: 'EVM-only' },
      { network: ChainNetwork.TRON, nftSupported: false, standards: [], reason: 'EVM-only' },
      { network: ChainNetwork.BITCOIN, nftSupported: false, standards: [], reason: 'EVM-only' },
    ];
  }

  async discoverByOwner(request: NftDiscoveryRequest): Promise<NftDiscoveryResult> {
    this.assertEvm(request.network);
    const result = await this.simulator.discoverByOwner(request);
    return {
      ...result,
      items: result.items.map((item) => ({
        ...item,
        rawMetadata: { ...(item.rawMetadata ?? {}), source: this.code },
      })),
    };
  }

  async getAsset(network: ChainNetwork, contractAddress: string, tokenId: string) {
    this.assertEvm(network);
    return this.simulator.getAsset(network, contractAddress, tokenId);
  }

  async verifyOwnership(
    network: ChainNetwork,
    contractAddress: string,
    tokenId: string,
    ownerAddress: string,
  ) {
    this.assertEvm(network);
    return this.simulator.verifyOwnership(network, contractAddress, tokenId, ownerAddress);
  }

  async getCollection(network: ChainNetwork, slugOrContract: string) {
    this.assertEvm(network);
    return this.simulator.getCollection(network, slugOrContract);
  }

  async listCollections(network: ChainNetwork): Promise<NftCollectionSnapshot[]> {
    this.assertEvm(network);
    return this.simulator.listCollections(network);
  }

  async refreshMetadata(network: ChainNetwork, contractAddress: string, tokenId: string) {
    this.assertEvm(network);
    return this.simulator.refreshMetadata(network, contractAddress, tokenId);
  }

  async healthCheck() {
    return { healthy: true, latencyMs: 2, detail: 'alchemy_nft_sim ok' };
  }

  private assertEvm(network: ChainNetwork): void {
    if (network !== ChainNetwork.ETHEREUM && network !== ChainNetwork.BNB_SMART_CHAIN) {
      throw new NftUnsupportedNetworkError(network, 'alchemy_nft_sim supports ETH/BSC only');
    }
  }
}
