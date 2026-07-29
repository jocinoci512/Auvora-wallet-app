import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '@auvora/database';
import { ForbiddenError, NotFoundError, ValidationError } from '../../domain/errors';
import { MARKET_EVENT_WATCHLIST_UPDATED } from '../../domain/events';
import {
  NOTIFICATIONS_PUBLISHER,
  type NotificationsPublisherPort,
} from '../../infrastructure/notifications/notifications-publisher.adapter';

@Injectable()
export class WatchlistService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(NOTIFICATIONS_PUBLISHER) private readonly notifications: NotificationsPublisherPort,
  ) {}

  async getOrCreateDefault(ownerUserId: string) {
    const existing = await this.prisma.marketWatchlist.findFirst({
      where: { ownerUserId, isDefault: true },
      include: {
        items: {
          include: { metadata: true },
          orderBy: [{ isPinned: 'desc' }, { sortOrder: 'asc' }],
        },
      },
    });
    if (existing) return this.mapWatchlist(existing);
    const created = await this.prisma.marketWatchlist.create({
      data: { ownerUserId, name: 'Default', isDefault: true },
      include: { items: { include: { metadata: true } } },
    });
    return this.mapWatchlist(created);
  }

  async addAsset(
    ownerUserId: string,
    input: { metadataId?: string; symbol?: string; network?: string },
  ) {
    const watchlist = await this.ensureDefault(ownerUserId);
    const metadataId = await this.resolveMetadataId(input);
    const item = await this.prisma.marketWatchlistItem.upsert({
      where: { watchlistId_metadataId: { watchlistId: watchlist.id, metadataId } },
      create: { watchlistId: watchlist.id, metadataId },
      update: {},
      include: { metadata: true },
    });
    await this.notifications.publishEvent({
      eventType: MARKET_EVENT_WATCHLIST_UPDATED,
      aggregateId: watchlist.id,
      payload: { ownerUserId, action: 'add', metadataId },
    });
    return this.mapItem(item);
  }

  async removeAsset(ownerUserId: string, metadataId: string) {
    const watchlist = await this.ensureDefault(ownerUserId);
    await this.prisma.marketWatchlistItem.deleteMany({
      where: { watchlistId: watchlist.id, metadataId },
    });
    await this.notifications.publishEvent({
      eventType: MARKET_EVENT_WATCHLIST_UPDATED,
      aggregateId: watchlist.id,
      payload: { ownerUserId, action: 'remove', metadataId },
    });
    return { removed: true };
  }

  async setFavorite(ownerUserId: string, metadataId: string, isFavorite: boolean) {
    const watchlist = await this.ensureDefault(ownerUserId);
    const item = await this.prisma.marketWatchlistItem.updateMany({
      where: { watchlistId: watchlist.id, metadataId },
      data: { isFavorite },
    });
    if (!item.count) throw new NotFoundError('Watchlist item not found');
    return this.getOrCreateDefault(ownerUserId);
  }

  async setPinned(ownerUserId: string, metadataId: string, isPinned: boolean) {
    const watchlist = await this.ensureDefault(ownerUserId);
    const item = await this.prisma.marketWatchlistItem.updateMany({
      where: { watchlistId: watchlist.id, metadataId },
      data: { isPinned },
    });
    if (!item.count) throw new NotFoundError('Watchlist item not found');
    return this.getOrCreateDefault(ownerUserId);
  }

  async syncFromSymbols(ownerUserId: string, symbols: Array<{ symbol: string; network: string }>) {
    for (const s of symbols) {
      await this.addAsset(ownerUserId, s);
    }
    return this.getOrCreateDefault(ownerUserId);
  }

  private async ensureDefault(ownerUserId: string) {
    const existing = await this.prisma.marketWatchlist.findFirst({
      where: { ownerUserId, isDefault: true },
    });
    if (existing) return existing;
    return this.prisma.marketWatchlist.create({
      data: { ownerUserId, name: 'Default', isDefault: true },
    });
  }

  private async resolveMetadataId(input: {
    metadataId?: string;
    symbol?: string;
    network?: string;
  }): Promise<string> {
    if (input.metadataId) return input.metadataId;
    if (!input.symbol || !input.network) {
      throw new ValidationError('metadataId or symbol+network required');
    }
    const row = await this.prisma.assetMarketMetadata.findFirst({
      where: {
        symbol: input.symbol.toUpperCase(),
        network: input.network as never,
      },
    });
    if (!row) throw new NotFoundError(`Metadata not found for ${input.symbol}`);
    return row.id;
  }

  private mapWatchlist(row: {
    id: string;
    ownerUserId: string;
    name: string;
    isDefault: boolean;
    items: Array<{
      id: string;
      metadataId: string;
      isFavorite: boolean;
      isPinned: boolean;
      sortOrder: number;
      metadata: { symbol: string; name: string; network: string; logoUrl: string | null };
    }>;
  }) {
    return {
      id: row.id,
      ownerUserId: row.ownerUserId,
      name: row.name,
      isDefault: row.isDefault,
      items: row.items.map((i) => this.mapItem(i)),
    };
  }

  private mapItem(item: {
    id: string;
    metadataId: string;
    isFavorite: boolean;
    isPinned: boolean;
    sortOrder: number;
    metadata: { symbol: string; name: string; network: string; logoUrl: string | null };
  }) {
    return {
      id: item.id,
      metadataId: item.metadataId,
      isFavorite: item.isFavorite,
      isPinned: item.isPinned,
      sortOrder: item.sortOrder,
      symbol: item.metadata.symbol,
      name: item.metadata.name,
      network: item.metadata.network,
      logoUrl: item.metadata.logoUrl,
    };
  }

  assertOwner(ownerUserId: string, requesterId: string, isAdmin: boolean): void {
    if (ownerUserId !== requesterId && !isAdmin) {
      throw new ForbiddenError('Access denied');
    }
  }
}
