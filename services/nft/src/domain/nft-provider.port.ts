import type { ChainNetwork } from '@auvora/database';

export type NftStandard = 'ERC721' | 'ERC1155' | 'BEP721' | 'BEP1155' | 'SPL' | 'TRC721' | 'OTHER';

export type NftNetworkCapability = {
  network: ChainNetwork;
  nftSupported: boolean;
  standards: NftStandard[];
  reason?: string;
};

export type NftTrait = { traitType: string; value: string; displayType?: string };

export type NftAssetSnapshot = {
  network: ChainNetwork;
  standard: NftStandard;
  contractAddress: string;
  tokenId: string;
  ownerAddress: string;
  name: string;
  description: string;
  imageUrl: string | null;
  animationUrl: string | null;
  videoUrl: string | null;
  collectionSlug: string;
  collectionName: string;
  traits: NftTrait[];
  verifiedCollection: boolean;
  creatorAddress: string | null;
  balance: string;
  rawMetadata?: Record<string, unknown>;
};

export type NftCollectionSnapshot = {
  network: ChainNetwork;
  slug: string;
  name: string;
  description: string;
  logoUrl: string | null;
  contractAddress: string;
  standard: NftStandard;
  verified: boolean;
  creatorAddress: string | null;
  totalSupply: number;
  ownersCount: number;
  floorPriceUsd: string | null;
};

export type NftDiscoveryRequest = {
  network: ChainNetwork;
  ownerAddress: string;
  cursor?: string;
  limit?: number;
};

export type NftDiscoveryResult = {
  items: NftAssetSnapshot[];
  nextCursor: string | null;
  latencyMs: number;
};

export const NFT_PROVIDER = Symbol('NFT_PROVIDER');

export interface NftProviderPort {
  readonly code: string;
  readonly name: string;
  getSupportedNetworks(): NftNetworkCapability[];
  discoverByOwner(request: NftDiscoveryRequest): Promise<NftDiscoveryResult>;
  getAsset(
    network: ChainNetwork,
    contractAddress: string,
    tokenId: string,
  ): Promise<NftAssetSnapshot | null>;
  verifyOwnership(
    network: ChainNetwork,
    contractAddress: string,
    tokenId: string,
    ownerAddress: string,
  ): Promise<boolean>;
  getCollection(
    network: ChainNetwork,
    slugOrContract: string,
  ): Promise<NftCollectionSnapshot | null>;
  listCollections(network: ChainNetwork): Promise<NftCollectionSnapshot[]>;
  refreshMetadata(
    network: ChainNetwork,
    contractAddress: string,
    tokenId: string,
  ): Promise<NftAssetSnapshot | null>;
  healthCheck(): Promise<{ healthy: boolean; latencyMs: number; detail?: string }>;
}
