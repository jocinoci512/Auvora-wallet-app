import { Injectable } from '@nestjs/common';
import { ChainNetwork } from '@auvora/database';
import { parseTraits, sanitizeText, sanitizeUrl } from '../../domain/metadata-sanitizer';
import { NftUnsupportedNetworkError } from '../../domain/errors';
import type {
  NftAssetSnapshot,
  NftCollectionSnapshot,
  NftDiscoveryRequest,
  NftDiscoveryResult,
  NftNetworkCapability,
  NftProviderPort,
} from '../../domain/nft-provider.port';

type CatalogItem = NftAssetSnapshot;

const CATALOG: CatalogItem[] = [
  {
    network: ChainNetwork.ETHEREUM,
    standard: 'ERC721',
    contractAddress: '0xbc4ca0eda7647a8ab7c2061c2e118a18a936f13d',
    tokenId: '1',
    ownerAddress: '0x1111111111111111111111111111111111111111',
    name: 'Bored Ape #1',
    description: 'Simulator ERC-721 ape',
    imageUrl: 'https://cdn.auvora.local/nft/bayc-1.png',
    animationUrl: null,
    videoUrl: null,
    collectionSlug: 'bored-ape-simulator',
    collectionName: 'Bored Ape Simulator',
    traits: [
      { traitType: 'Fur', value: 'Brown' },
      { traitType: 'Eyes', value: 'Bored' },
    ],
    verifiedCollection: true,
    creatorAddress: '0xcreator000000000000000000000000000000001',
    balance: '1',
  },
  {
    network: ChainNetwork.ETHEREUM,
    standard: 'ERC1155',
    contractAddress: '0x495f947276749ce646f68ac8c248420045cb7b5e',
    tokenId: '42',
    ownerAddress: '0x1111111111111111111111111111111111111111',
    name: 'Edition Drop #42',
    description: 'Simulator ERC-1155 edition',
    imageUrl: 'https://cdn.auvora.local/nft/edition-42.png',
    animationUrl: 'https://cdn.auvora.local/nft/edition-42.json',
    videoUrl: 'https://cdn.auvora.local/nft/edition-42.mp4',
    collectionSlug: 'edition-drop-simulator',
    collectionName: 'Edition Drop Simulator',
    traits: [{ traitType: 'Rarity', value: 'Rare' }],
    verifiedCollection: true,
    creatorAddress: '0xcreator000000000000000000000000000000002',
    balance: '3',
  },
  {
    network: ChainNetwork.BNB_SMART_CHAIN,
    standard: 'BEP721',
    contractAddress: '0x00000000000000000000000000000000000000b1',
    tokenId: '7',
    ownerAddress: '0x2222222222222222222222222222222222222222',
    name: 'Pancake NFT #7',
    description: 'Simulator BEP-721',
    imageUrl: 'https://cdn.auvora.local/nft/pancake-7.png',
    animationUrl: null,
    videoUrl: null,
    collectionSlug: 'pancake-simulator',
    collectionName: 'Pancake Simulator',
    traits: [{ traitType: 'Tier', value: 'Gold' }],
    verifiedCollection: true,
    creatorAddress: null,
    balance: '1',
  },
  {
    network: ChainNetwork.SOLANA,
    standard: 'SPL',
    contractAddress: 'So11111111111111111111111111111111111111112',
    tokenId: 'mint-sol-nft-1',
    ownerAddress: 'SoLOwner111111111111111111111111111111111',
    name: 'Solana Pixel #1',
    description: 'Simulator SPL NFT',
    imageUrl: 'https://cdn.auvora.local/nft/sol-pixel-1.png',
    animationUrl: 'https://cdn.auvora.local/nft/sol-pixel-1.webp',
    videoUrl: null,
    collectionSlug: 'sol-pixel-simulator',
    collectionName: 'Sol Pixel Simulator',
    traits: [{ traitType: 'Background', value: 'Aurora' }],
    verifiedCollection: true,
    creatorAddress: 'SoLCreator111111111111111111111111111111',
    balance: '1',
  },
  {
    network: ChainNetwork.TRON,
    standard: 'TRC721',
    contractAddress: 'TNftContract1111111111111111111111111',
    tokenId: '9',
    ownerAddress: 'TOwner111111111111111111111111111111',
    name: 'Tron Art #9',
    description: 'Simulator TRC-721',
    imageUrl: 'https://cdn.auvora.local/nft/tron-9.png',
    animationUrl: null,
    videoUrl: null,
    collectionSlug: 'tron-art-simulator',
    collectionName: 'Tron Art Simulator',
    traits: [{ traitType: 'Style', value: 'Neon' }],
    verifiedCollection: false,
    creatorAddress: null,
    balance: '1',
  },
];

@Injectable()
export class SimulatorNftProvider implements NftProviderPort {
  readonly code = 'simulator';
  readonly name = 'Auvora NFT Simulator';

  getSupportedNetworks(): NftNetworkCapability[] {
    return [
      {
        network: ChainNetwork.ETHEREUM,
        nftSupported: true,
        standards: ['ERC721', 'ERC1155'],
      },
      {
        network: ChainNetwork.BNB_SMART_CHAIN,
        nftSupported: true,
        standards: ['BEP721', 'BEP1155'],
      },
      { network: ChainNetwork.SOLANA, nftSupported: true, standards: ['SPL'] },
      { network: ChainNetwork.TRON, nftSupported: true, standards: ['TRC721'] },
      {
        network: ChainNetwork.BITCOIN,
        nftSupported: false,
        standards: [],
        reason: 'Digital artifact support reserved for future Ordinals/inscription rails',
      },
    ];
  }

  async discoverByOwner(request: NftDiscoveryRequest): Promise<NftDiscoveryResult> {
    this.assertSupported(request.network);
    const started = Date.now();
    const items = CATALOG.filter(
      (item) =>
        item.network === request.network &&
        item.ownerAddress.toLowerCase() === request.ownerAddress.toLowerCase(),
    ).map((item) => this.sanitizeAsset(item));
    return { items, nextCursor: null, latencyMs: Date.now() - started };
  }

  async getAsset(
    network: ChainNetwork,
    contractAddress: string,
    tokenId: string,
  ): Promise<NftAssetSnapshot | null> {
    this.assertSupported(network);
    const found = CATALOG.find(
      (item) =>
        item.network === network &&
        item.contractAddress.toLowerCase() === contractAddress.toLowerCase() &&
        item.tokenId === tokenId,
    );
    return found ? this.sanitizeAsset(found) : null;
  }

  async verifyOwnership(
    network: ChainNetwork,
    contractAddress: string,
    tokenId: string,
    ownerAddress: string,
  ): Promise<boolean> {
    const asset = await this.getAsset(network, contractAddress, tokenId);
    if (!asset) return false;
    return asset.ownerAddress.toLowerCase() === ownerAddress.toLowerCase();
  }

  async getCollection(
    network: ChainNetwork,
    slugOrContract: string,
  ): Promise<NftCollectionSnapshot | null> {
    this.assertSupported(network);
    const match = CATALOG.find(
      (item) =>
        item.network === network &&
        (item.collectionSlug === slugOrContract ||
          item.contractAddress.toLowerCase() === slugOrContract.toLowerCase()),
    );
    if (!match) return null;
    return this.toCollection(match);
  }

  async listCollections(network: ChainNetwork): Promise<NftCollectionSnapshot[]> {
    if (network === ChainNetwork.BITCOIN) {
      return [];
    }
    this.assertSupported(network);
    const map = new Map<string, NftCollectionSnapshot>();
    for (const item of CATALOG.filter((c) => c.network === network)) {
      map.set(item.collectionSlug, this.toCollection(item));
    }
    return [...map.values()];
  }

  async refreshMetadata(
    network: ChainNetwork,
    contractAddress: string,
    tokenId: string,
  ): Promise<NftAssetSnapshot | null> {
    const asset = await this.getAsset(network, contractAddress, tokenId);
    if (!asset) return null;
    return {
      ...asset,
      description: sanitizeText(`${asset.description} (refreshed)`),
      rawMetadata: { refreshedAt: new Date().toISOString() },
    };
  }

  async healthCheck() {
    return { healthy: true, latencyMs: 1, detail: 'simulator ok' };
  }

  /** Expose catalog for secondary providers / tests */
  listCatalog(): CatalogItem[] {
    return CATALOG.map((item) => this.sanitizeAsset(item));
  }

  private toCollection(item: CatalogItem): NftCollectionSnapshot {
    const supply = CATALOG.filter((c) => c.collectionSlug === item.collectionSlug).length;
    return {
      network: item.network,
      slug: item.collectionSlug,
      name: item.collectionName,
      description: sanitizeText(`${item.collectionName} collection`),
      logoUrl: sanitizeUrl(item.imageUrl),
      contractAddress: item.contractAddress,
      standard: item.standard,
      verified: item.verifiedCollection,
      creatorAddress: item.creatorAddress,
      totalSupply: supply,
      ownersCount: new Set(
        CATALOG.filter((c) => c.collectionSlug === item.collectionSlug).map((c) => c.ownerAddress),
      ).size,
      floorPriceUsd: item.verifiedCollection ? '12.50' : null,
    };
  }

  private sanitizeAsset(item: CatalogItem): NftAssetSnapshot {
    return {
      ...item,
      name: sanitizeText(item.name, 256),
      description: sanitizeText(item.description, 2_000),
      imageUrl: sanitizeUrl(item.imageUrl),
      animationUrl: sanitizeUrl(item.animationUrl),
      videoUrl: sanitizeUrl(item.videoUrl),
      traits: parseTraits(item.traits),
    };
  }

  private assertSupported(network: ChainNetwork): void {
    if (network === ChainNetwork.BITCOIN) {
      throw new NftUnsupportedNetworkError(
        network,
        'Digital artifact support reserved for future Ordinals/inscription rails',
      );
    }
    const ok = this.getSupportedNetworks().some((n) => n.network === network && n.nftSupported);
    if (!ok) throw new NftUnsupportedNetworkError(network);
  }
}
