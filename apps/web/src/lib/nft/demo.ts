export type NftGalleryItem = {
  ownershipId: string;
  isFavorite: boolean;
  isHidden: boolean;
  acquiredAt?: string;
  asset: {
    id: string;
    name: string;
    tokenId: string;
    network: string;
    standard?: string;
    contractAddress?: string;
    description?: string;
    imageUrl?: string | null;
    videoUrl?: string | null;
    animationUrl?: string | null;
    audioUrl?: string | null;
    modelUrl?: string | null;
    traits?: Array<{ trait_type?: string; value?: string }> | Record<string, unknown>;
    rarityRank?: number | null;
    rarityScore?: number | null;
    collection?: { slug: string; name: string; verified: boolean; network?: string };
  };
};

export type NftCollectionSummary = {
  id: string;
  network: string;
  slug: string;
  name: string;
  verified: boolean;
  totalSupply: number;
  ownersCount?: number;
  floorPriceUsd?: string | null;
  volumeUsd?: string | null;
  logoUrl?: string | null;
  bannerUrl?: string | null;
  description?: string;
  standard?: string;
  creatorAddress?: string | null;
  assets?: Array<{
    id: string;
    name: string;
    tokenId: string;
    imageUrl?: string | null;
  }>;
};

export type NftActivityKind = 'received' | 'sent' | 'minted' | 'transferred' | 'listed';

export type NftActivityItem = {
  id: string;
  kind: NftActivityKind;
  title: string;
  detail: string;
  assetId?: string;
  network: string;
  timestamp: string;
  status: 'confirmed' | 'pending';
};

export const DEMO_NETWORKS = [
  { network: 'ETHEREUM', nftSupported: true, standards: ['ERC721', 'ERC1155'] },
  { network: 'POLYGON', nftSupported: true, standards: ['ERC721'] },
  { network: 'SOLANA', nftSupported: true, standards: ['Metaplex'] },
  { network: 'BNB_SMART_CHAIN', nftSupported: true, standards: ['BEP721'] },
  { network: 'BITCOIN', nftSupported: false, standards: [], reason: 'Ordinals planned' },
];

export const DEMO_COLLECTIONS: NftCollectionSummary[] = [
  {
    id: 'c1',
    network: 'ETHEREUM',
    slug: 'auvora-origins',
    name: 'Auvora Origins',
    verified: true,
    totalSupply: 888,
    ownersCount: 512,
    floorPriceUsd: '1.24',
    volumeUsd: '182400',
    logoUrl: '/nft-placeholder.svg',
    bannerUrl: null,
    description: 'Foundational collectibles for the Auvora ecosystem.',
    standard: 'ERC721',
    creatorAddress: '0xAUV0…ORIG',
    assets: [],
  },
  {
    id: 'c2',
    network: 'SOLANA',
    slug: 'sol-beacon',
    name: 'Sol Beacon',
    verified: true,
    totalSupply: 4444,
    ownersCount: 2100,
    floorPriceUsd: '0.42',
    volumeUsd: '95400',
    logoUrl: '/nft-placeholder.svg',
    description: 'Cross-chain signal marks minted on Solana.',
    standard: 'Metaplex',
  },
  {
    id: 'c3',
    network: 'POLYGON',
    slug: 'city-keys',
    name: 'City Keys',
    verified: false,
    totalSupply: 1200,
    ownersCount: 640,
    floorPriceUsd: '0.08',
    volumeUsd: '12400',
    logoUrl: '/nft-placeholder.svg',
    description: 'Tokenized city access badges.',
    standard: 'ERC721',
  },
];

export const DEMO_GALLERY: NftGalleryItem[] = [
  {
    ownershipId: 'o1',
    isFavorite: true,
    isHidden: false,
    acquiredAt: '2026-07-20T12:00:00.000Z',
    asset: {
      id: 'a1',
      name: 'Origin #12',
      tokenId: '12',
      network: 'ETHEREUM',
      standard: 'ERC721',
      contractAddress: '0x1111111111111111111111111111111111111111',
      description: 'A premium genesis piece from Auvora Origins.',
      imageUrl: '/nft-placeholder.svg',
      rarityRank: 12,
      rarityScore: 87.4,
      traits: [
        { trait_type: 'Background', value: 'Midnight' },
        { trait_type: 'Tier', value: 'Genesis' },
      ],
      collection: {
        slug: 'auvora-origins',
        name: 'Auvora Origins',
        verified: true,
        network: 'ETHEREUM',
      },
    },
  },
  {
    ownershipId: 'o2',
    isFavorite: false,
    isHidden: false,
    acquiredAt: '2026-07-22T09:00:00.000Z',
    asset: {
      id: 'a2',
      name: 'Beacon Pulse',
      tokenId: '901',
      network: 'SOLANA',
      standard: 'Metaplex',
      contractAddress: 'SoLBeAcOn111111111111111111111111111111',
      description: 'Animated signal collectible.',
      animationUrl: '/nft-placeholder.svg',
      imageUrl: '/nft-placeholder.svg',
      traits: [{ trait_type: 'Signal', value: 'Pulse' }],
      collection: { slug: 'sol-beacon', name: 'Sol Beacon', verified: true, network: 'SOLANA' },
    },
  },
  {
    ownershipId: 'o3',
    isFavorite: true,
    isHidden: false,
    acquiredAt: '2026-07-18T16:30:00.000Z',
    asset: {
      id: 'a3',
      name: 'Harbor Key',
      tokenId: '44',
      network: 'POLYGON',
      standard: 'ERC721',
      contractAddress: '0x2222222222222222222222222222222222222222',
      description: 'Tokenized access pass for Harbor district.',
      imageUrl: '/nft-placeholder.svg',
      videoUrl: null,
      traits: [
        { trait_type: 'District', value: 'Harbor' },
        { trait_type: 'Access', value: 'Gold' },
      ],
      collection: { slug: 'city-keys', name: 'City Keys', verified: false, network: 'POLYGON' },
    },
  },
  {
    ownershipId: 'o4',
    isFavorite: false,
    isHidden: true,
    acquiredAt: '2026-06-01T10:00:00.000Z',
    asset: {
      id: 'a4',
      name: 'Archive Relic',
      tokenId: '7',
      network: 'ETHEREUM',
      standard: 'ERC1155',
      contractAddress: '0x3333333333333333333333333333333333333333',
      description: 'Hidden archival collectible.',
      imageUrl: '/nft-placeholder.svg',
      collection: {
        slug: 'auvora-origins',
        name: 'Auvora Origins',
        verified: true,
        network: 'ETHEREUM',
      },
    },
  },
  {
    ownershipId: 'o5',
    isFavorite: false,
    isHidden: false,
    acquiredAt: '2026-07-25T08:00:00.000Z',
    asset: {
      id: 'a5',
      name: 'Resonance Loop',
      tokenId: '3',
      network: 'ETHEREUM',
      standard: 'ERC721',
      contractAddress: '0x4444444444444444444444444444444444444444',
      description: 'Audio-first collectible (preview mode).',
      audioUrl: 'placeholder',
      imageUrl: '/nft-placeholder.svg',
      traits: [{ trait_type: 'Medium', value: 'Audio' }],
      collection: {
        slug: 'auvora-origins',
        name: 'Auvora Origins',
        verified: true,
        network: 'ETHEREUM',
      },
    },
  },
];

export const DEMO_ACTIVITY: NftActivityItem[] = [
  {
    id: 'n1',
    kind: 'received',
    title: 'Received Origin #12',
    detail: 'From 0xabc…def · Ethereum',
    assetId: 'a1',
    network: 'ETHEREUM',
    timestamp: '2026-07-20T12:00:00.000Z',
    status: 'confirmed',
  },
  {
    id: 'n2',
    kind: 'minted',
    title: 'Minted Beacon Pulse',
    detail: 'Sol Beacon · Solana',
    assetId: 'a2',
    network: 'SOLANA',
    timestamp: '2026-07-22T09:00:00.000Z',
    status: 'confirmed',
  },
  {
    id: 'n3',
    kind: 'listed',
    title: 'Listed Harbor Key (placeholder)',
    detail: 'Marketplace listing — coming soon',
    assetId: 'a3',
    network: 'POLYGON',
    timestamp: '2026-07-24T14:00:00.000Z',
    status: 'pending',
  },
  {
    id: 'n4',
    kind: 'transferred',
    title: 'Transferred Archive Relic',
    detail: 'Internal wallet move',
    assetId: 'a4',
    network: 'ETHEREUM',
    timestamp: '2026-06-02T11:00:00.000Z',
    status: 'confirmed',
  },
];
