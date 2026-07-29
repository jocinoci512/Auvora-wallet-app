import {
  Inject,
  Injectable,
  Logger,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import { PrismaService } from '@auvora/database';
import { ENV, type ServiceEnv } from '../../config/env.schema';
import { NftProviderRegistry } from '../../infrastructure/providers/provider-registry';
import { REDIS_PORT, type RedisPort } from '../../infrastructure/redis/redis.port';
import { ID_GENERATOR, type IdGeneratorPort } from '../ports/clock.port';
import { NftEngineService } from './nft-engine.service';

@Injectable()
export class NftWorkersService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(NftWorkersService.name);
  private timers: NodeJS.Timeout[] = [];

  constructor(
    @Inject(ENV) private readonly env: ServiceEnv,
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(NftProviderRegistry) private readonly registry: NftProviderRegistry,
    @Inject(NftEngineService) private readonly engine: NftEngineService,
    @Inject(REDIS_PORT) private readonly redis: RedisPort,
    @Inject(ID_GENERATOR) private readonly ids: IdGeneratorPort,
  ) {}

  onModuleInit(): void {
    if (!this.env.NFT_WORKERS_ENABLED) {
      this.logger.log('NFT workers disabled');
      return;
    }
    this.timers.push(setInterval(() => void this.syncNfts(), this.env.NFT_SYNC_INTERVAL_MS));
    this.timers.push(
      setInterval(() => void this.syncMetadata(), this.env.NFT_METADATA_INTERVAL_MS),
    );
    this.timers.push(
      setInterval(() => void this.cacheMedia(), this.env.NFT_MEDIA_CACHE_INTERVAL_MS),
    );
    this.timers.push(
      setInterval(() => void this.verifyOwnership(), this.env.NFT_OWNERSHIP_INTERVAL_MS),
    );
    this.timers.push(
      setInterval(() => void this.updateCollections(), this.env.NFT_COLLECTION_INTERVAL_MS),
    );
    this.timers.push(setInterval(() => void this.processRetries(), this.env.NFT_RETRY_INTERVAL_MS));
    this.logger.log('NFT workers started');
  }

  onModuleDestroy(): void {
    for (const t of this.timers) clearInterval(t);
    this.timers = [];
  }

  status() {
    return {
      enabled: this.env.NFT_WORKERS_ENABLED,
      running: this.timers.length > 0,
      timers: this.timers.length,
    };
  }

  private async syncNfts() {
    try {
      await this.redis.set('nft:worker:sync', new Date().toISOString(), 120);
      for (const p of this.registry.listProviders()) {
        const health = await this.registry.getProvider(p.code).healthCheck();
        await this.prisma.nftProviderHealth.upsert({
          where: { code: p.code },
          create: {
            id: this.ids.uuid(),
            code: p.code,
            name: p.name,
            isEnabled: true,
            lastSuccessAt: health.healthy ? new Date() : null,
            lastFailureAt: health.healthy ? null : new Date(),
            lastLatencyMs: health.latencyMs,
            failureCount: health.healthy ? 0 : 1,
          },
          update: {
            lastSuccessAt: health.healthy ? new Date() : undefined,
            lastFailureAt: health.healthy ? undefined : new Date(),
            lastLatencyMs: health.latencyMs,
            failureCount: health.healthy ? 0 : { increment: 1 },
          },
        });
      }
    } catch (error) {
      this.logger.warn(
        `nft sync worker: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  private async syncMetadata() {
    try {
      const assets = await this.prisma.nftAsset.findMany({
        orderBy: { lastSyncedAt: 'asc' },
        take: 10,
      });
      for (const asset of assets) {
        await this.engine.refreshMetadata(asset.id);
      }
    } catch (error) {
      this.logger.warn(
        `metadata worker: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  private async cacheMedia() {
    try {
      await this.redis.set('nft:worker:media', new Date().toISOString(), 120);
      const pending = await this.prisma.nftMediaCache.findMany({
        where: { status: 'PENDING' },
        take: 20,
      });
      for (const row of pending) {
        await this.prisma.nftMediaCache.update({
          where: { id: row.id },
          data: { status: 'READY', cachedUrl: row.sourceUrl, lastFetchedAt: new Date() },
        });
      }
    } catch (error) {
      this.logger.warn(
        `media cache worker: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  private async verifyOwnership() {
    try {
      const rows = await this.prisma.nftOwnership.findMany({
        take: 20,
        orderBy: { updatedAt: 'asc' },
      });
      for (const row of rows) {
        await this.engine.verifyOwnership(row.userId, row.assetId);
      }
    } catch (error) {
      this.logger.warn(
        `ownership worker: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  private async updateCollections() {
    try {
      for (const network of ['ETHEREUM', 'BNB_SMART_CHAIN', 'SOLANA', 'TRON'] as const) {
        await this.engine.listCollections(network as never);
      }
    } catch (error) {
      this.logger.warn(
        `collection worker: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  private async processRetries() {
    try {
      const jobs = await this.prisma.nftRetryJob.findMany({
        where: { status: 'PENDING' },
        take: 20,
      });
      for (const job of jobs) {
        await this.prisma.nftRetryJob.update({
          where: { id: job.id },
          data: { status: 'PROCESSED', processedAt: new Date() },
        });
      }
    } catch (error) {
      this.logger.warn(`retry worker: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}
