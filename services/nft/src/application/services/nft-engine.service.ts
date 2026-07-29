import { Inject, Injectable, Logger } from '@nestjs/common';
import { type ChainNetwork, NftMediaKind, type Prisma, PrismaService } from '@auvora/database';
import { NFT_EVENTS } from '../../domain/events';
import { NftNotFoundError, NftValidationError } from '../../domain/errors';
import { NFT_PROVIDER, type NftProviderPort } from '../../domain/nft-provider.port';
import { ENV, type ServiceEnv } from '../../config/env.schema';
import {
  ANALYTICS_PUBLISHER,
  type AnalyticsPublisherPort,
} from '../../infrastructure/analytics/analytics-publisher.adapter';
import { AI_PUBLISHER, type AiPublisherPort } from '../../infrastructure/ai/ai-publisher.adapter';
import {
  NOTIFICATIONS_PUBLISHER,
  type NotificationsPublisherPort,
} from '../../infrastructure/notifications/notifications-publisher.adapter';
import { REDIS_PORT, type RedisPort } from '../../infrastructure/redis/redis.port';
import { CLOCK, ID_GENERATOR, type ClockPort, type IdGeneratorPort } from '../ports/clock.port';

export type GalleryQuery = {
  network?: ChainNetwork;
  collectionSlug?: string;
  q?: string;
  sort?: 'name_asc' | 'name_desc' | 'recent' | 'token_asc';
  favoritesOnly?: boolean;
  includeHidden?: boolean;
  limit?: number;
};

@Injectable()
export class NftEngineService {
  private readonly logger = new Logger(NftEngineService.name);

  constructor(
    @Inject(ENV) private readonly env: ServiceEnv,
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(NFT_PROVIDER) private readonly providers: NftProviderPort,
    @Inject(REDIS_PORT) private readonly redis: RedisPort,
    @Inject(CLOCK) private readonly clock: ClockPort,
    @Inject(ID_GENERATOR) private readonly ids: IdGeneratorPort,
    @Inject(ANALYTICS_PUBLISHER) private readonly analytics: AnalyticsPublisherPort,
    @Inject(NOTIFICATIONS_PUBLISHER) private readonly notifications: NotificationsPublisherPort,
    @Inject(AI_PUBLISHER) private readonly ai: AiPublisherPort,
  ) {}

  listNetworks() {
    return this.providers.getSupportedNetworks();
  }

  async discoverAndSync(userId: string, network: ChainNetwork, ownerAddress: string) {
    if (!ownerAddress || ownerAddress.length < 8) {
      throw new NftValidationError('ownerAddress is required');
    }
    const started = Date.now();
    const discovery = await this.providers.discoverByOwner({ network, ownerAddress, limit: 100 });
    const synced = [];
    for (const item of discovery.items) {
      const collection = await this.upsertCollection(item);
      const asset = await this.prisma.nftAsset.upsert({
        where: {
          network_contractAddress_tokenId: {
            network: item.network,
            contractAddress: item.contractAddress,
            tokenId: item.tokenId,
          },
        },
        create: {
          id: this.ids.uuid(),
          network: item.network,
          standard: item.standard,
          contractAddress: item.contractAddress,
          tokenId: item.tokenId,
          ownerAddress: item.ownerAddress,
          name: item.name,
          description: item.description,
          imageUrl: item.imageUrl,
          animationUrl: item.animationUrl,
          videoUrl: item.videoUrl,
          collectionId: collection.id,
          traits: item.traits as unknown as Prisma.InputJsonValue,
          balance: item.balance,
          verifiedCollection: item.verifiedCollection,
          creatorAddress: item.creatorAddress,
          rawMetadata: (item.rawMetadata ?? {}) as Prisma.InputJsonValue,
          lastSyncedAt: this.clock.now(),
        },
        update: {
          ownerAddress: item.ownerAddress,
          name: item.name,
          description: item.description,
          imageUrl: item.imageUrl,
          animationUrl: item.animationUrl,
          videoUrl: item.videoUrl,
          traits: item.traits as unknown as Prisma.InputJsonValue,
          balance: item.balance,
          verifiedCollection: item.verifiedCollection,
          lastSyncedAt: this.clock.now(),
        },
      });

      await this.prisma.nftOwnership.upsert({
        where: {
          userId_assetId: { userId, assetId: asset.id },
        },
        create: {
          id: this.ids.uuid(),
          userId,
          assetId: asset.id,
          ownerAddress,
          isFavorite: false,
          isHidden: false,
          verifiedAt: this.clock.now(),
        },
        update: {
          ownerAddress,
          verifiedAt: this.clock.now(),
        },
      });

      await this.cacheMedia(asset.id, item.imageUrl, item.animationUrl, item.videoUrl);
      synced.push(asset);
    }

    const durationMs = Date.now() - started;
    void this.analytics.publishEvent({
      eventType: NFT_EVENTS.DISCOVERED,
      aggregateId: userId,
      payload: { network, count: synced.length, durationMs, ownerAddress },
    });
    void this.ai.publish(NFT_EVENTS.DISCOVERED, { userId, network, count: synced.length });

    return { synced: synced.length, durationMs, items: synced };
  }

  async gallery(userId: string, query: GalleryQuery) {
    const ownerships = await this.prisma.nftOwnership.findMany({
      where: {
        userId,
        ...(query.favoritesOnly ? { isFavorite: true } : {}),
        ...(query.includeHidden ? {} : { isHidden: false }),
        asset: {
          ...(query.network ? { network: query.network } : {}),
          ...(query.collectionSlug ? { collection: { slug: query.collectionSlug } } : {}),
          ...(query.q
            ? {
                OR: [
                  { name: { contains: query.q, mode: 'insensitive' } },
                  { tokenId: { contains: query.q } },
                  { contractAddress: { contains: query.q, mode: 'insensitive' } },
                ],
              }
            : {}),
        },
      },
      include: { asset: { include: { collection: true, mediaCache: true } } },
      take: Math.min(query.limit ?? 50, 100),
    });

    const rows = ownerships.map((row) => ({
      ownershipId: row.id,
      isFavorite: row.isFavorite,
      isHidden: row.isHidden,
      asset: row.asset,
    }));

    switch (query.sort) {
      case 'name_desc':
        rows.sort((a, b) => b.asset.name.localeCompare(a.asset.name));
        break;
      case 'token_asc':
        rows.sort((a, b) => a.asset.tokenId.localeCompare(b.asset.tokenId));
        break;
      case 'recent':
        rows.sort(
          (a, b) => (b.asset.lastSyncedAt?.getTime() ?? 0) - (a.asset.lastSyncedAt?.getTime() ?? 0),
        );
        break;
      default:
        rows.sort((a, b) => a.asset.name.localeCompare(b.asset.name));
    }

    return rows;
  }

  async getAssetDetail(userId: string, assetId: string) {
    const ownership = await this.prisma.nftOwnership.findFirst({
      where: { userId, assetId },
      include: { asset: { include: { collection: true, mediaCache: true } } },
    });
    if (!ownership) throw new NftNotFoundError('NFT not found in gallery');
    return ownership;
  }

  async setFavorite(userId: string, assetId: string, isFavorite: boolean) {
    return this.prisma.nftOwnership.update({
      where: { userId_assetId: { userId, assetId } },
      data: { isFavorite },
    });
  }

  async setHidden(userId: string, assetId: string, isHidden: boolean) {
    return this.prisma.nftOwnership.update({
      where: { userId_assetId: { userId, assetId } },
      data: { isHidden },
    });
  }

  async verifyOwnership(userId: string, assetId: string) {
    const ownership = await this.prisma.nftOwnership.findFirst({
      where: { userId, assetId },
      include: { asset: true },
    });
    if (!ownership) throw new NftNotFoundError();
    const ok = await this.providers.verifyOwnership(
      ownership.asset.network,
      ownership.asset.contractAddress,
      ownership.asset.tokenId,
      ownership.ownerAddress,
    );
    await this.prisma.nftOwnership.update({
      where: { id: ownership.id },
      data: { verifiedAt: ok ? this.clock.now() : null },
    });
    void this.analytics.publishEvent({
      eventType: NFT_EVENTS.OWNERSHIP_VERIFIED,
      aggregateId: assetId,
      payload: { userId, ok },
    });
    return { assetId, verified: ok };
  }

  async listCollections(network?: ChainNetwork) {
    if (network) {
      const remote = await this.providers.listCollections(network);
      for (const collection of remote) {
        await this.prisma.nftCollection.upsert({
          where: { network_slug: { network: collection.network, slug: collection.slug } },
          create: {
            id: this.ids.uuid(),
            network: collection.network,
            slug: collection.slug,
            name: collection.name,
            description: collection.description,
            logoUrl: collection.logoUrl,
            contractAddress: collection.contractAddress,
            standard: collection.standard,
            verified: collection.verified,
            creatorAddress: collection.creatorAddress,
            totalSupply: collection.totalSupply,
            ownersCount: collection.ownersCount,
            floorPriceUsd: collection.floorPriceUsd,
            lastSyncedAt: this.clock.now(),
          },
          update: {
            name: collection.name,
            description: collection.description,
            logoUrl: collection.logoUrl,
            verified: collection.verified,
            totalSupply: collection.totalSupply,
            ownersCount: collection.ownersCount,
            floorPriceUsd: collection.floorPriceUsd,
            lastSyncedAt: this.clock.now(),
          },
        });
      }
    }
    return this.prisma.nftCollection.findMany({
      where: network ? { network } : undefined,
      orderBy: { name: 'asc' },
    });
  }

  async getCollection(network: ChainNetwork, slug: string) {
    const local = await this.prisma.nftCollection.findUnique({
      where: { network_slug: { network, slug } },
      include: { assets: { take: 24 } },
    });
    if (local) return local;
    const remote = await this.providers.getCollection(network, slug);
    if (!remote) throw new NftNotFoundError('Collection not found');
    return this.upsertCollectionFromSnapshot(remote);
  }

  async refreshMetadata(assetId: string) {
    const asset = await this.prisma.nftAsset.findUnique({ where: { id: assetId } });
    if (!asset) throw new NftNotFoundError();
    const refreshed = await this.providers.refreshMetadata(
      asset.network,
      asset.contractAddress,
      asset.tokenId,
    );
    if (!refreshed) throw new NftNotFoundError('Metadata refresh failed');
    const updated = await this.prisma.nftAsset.update({
      where: { id: assetId },
      data: {
        name: refreshed.name,
        description: refreshed.description,
        imageUrl: refreshed.imageUrl,
        animationUrl: refreshed.animationUrl,
        videoUrl: refreshed.videoUrl,
        traits: refreshed.traits as unknown as Prisma.InputJsonValue,
        rawMetadata: (refreshed.rawMetadata ?? {}) as Prisma.InputJsonValue,
        lastSyncedAt: this.clock.now(),
      },
    });
    await this.cacheMedia(assetId, refreshed.imageUrl, refreshed.animationUrl, refreshed.videoUrl);
    void this.analytics.publishEvent({
      eventType: NFT_EVENTS.METADATA_SYNCED,
      aggregateId: assetId,
      payload: { network: asset.network },
    });
    return updated;
  }

  private async upsertCollection(item: {
    network: ChainNetwork;
    collectionSlug: string;
    collectionName: string;
    contractAddress: string;
    standard: string;
    verifiedCollection: boolean;
    creatorAddress: string | null;
    imageUrl: string | null;
  }) {
    return this.prisma.nftCollection.upsert({
      where: {
        network_slug: { network: item.network, slug: item.collectionSlug },
      },
      create: {
        id: this.ids.uuid(),
        network: item.network,
        slug: item.collectionSlug,
        name: item.collectionName,
        description: item.collectionName,
        logoUrl: item.imageUrl,
        contractAddress: item.contractAddress,
        standard: item.standard,
        verified: item.verifiedCollection,
        creatorAddress: item.creatorAddress,
        totalSupply: 1,
        ownersCount: 1,
        floorPriceUsd: item.verifiedCollection ? '12.50' : null,
        lastSyncedAt: this.clock.now(),
      },
      update: {
        name: item.collectionName,
        logoUrl: item.imageUrl,
        verified: item.verifiedCollection,
        lastSyncedAt: this.clock.now(),
      },
    });
  }

  private async upsertCollectionFromSnapshot(collection: {
    network: ChainNetwork;
    slug: string;
    name: string;
    description: string;
    logoUrl: string | null;
    contractAddress: string;
    standard: string;
    verified: boolean;
    creatorAddress: string | null;
    totalSupply: number;
    ownersCount: number;
    floorPriceUsd: string | null;
  }) {
    return this.prisma.nftCollection.upsert({
      where: { network_slug: { network: collection.network, slug: collection.slug } },
      create: {
        id: this.ids.uuid(),
        ...collection,
        lastSyncedAt: this.clock.now(),
      },
      update: {
        name: collection.name,
        description: collection.description,
        logoUrl: collection.logoUrl,
        verified: collection.verified,
        totalSupply: collection.totalSupply,
        ownersCount: collection.ownersCount,
        floorPriceUsd: collection.floorPriceUsd,
        lastSyncedAt: this.clock.now(),
      },
    });
  }

  private async cacheMedia(
    assetId: string,
    imageUrl: string | null,
    animationUrl: string | null,
    videoUrl: string | null,
  ) {
    const urls: Array<{ kind: NftMediaKind; url: string }> = [];
    if (imageUrl) urls.push({ kind: NftMediaKind.IMAGE, url: imageUrl });
    if (animationUrl) urls.push({ kind: NftMediaKind.ANIMATION, url: animationUrl });
    if (videoUrl) urls.push({ kind: NftMediaKind.VIDEO, url: videoUrl });
    for (const entry of urls) {
      await this.prisma.nftMediaCache.upsert({
        where: { assetId_kind: { assetId, kind: entry.kind } },
        create: {
          id: this.ids.uuid(),
          assetId,
          kind: entry.kind,
          sourceUrl: entry.url,
          cachedUrl: entry.url,
          contentType: entry.kind === NftMediaKind.VIDEO ? 'video/mp4' : 'image/png',
          bytes: 0,
          status: 'READY',
          lastFetchedAt: this.clock.now(),
        },
        update: {
          sourceUrl: entry.url,
          cachedUrl: entry.url,
          status: 'READY',
          lastFetchedAt: this.clock.now(),
        },
      });
      if (entry.url) {
        await this.redis.set(
          `nft:media:${assetId}:${entry.kind}`,
          entry.url,
          this.env.NFT_MEDIA_CACHE_TTL_SECONDS,
        );
      }
    }
  }
}
