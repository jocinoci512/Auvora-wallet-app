import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  type ChainNetwork,
  PrismaService,
  AssetStandard,
  type MarketTokenVerification,
} from '@auvora/database';
import { ENV, type ServiceEnv } from '../../config/env.schema';
import {
  MARKET_DATA_PROVIDER,
  type MarketDataProviderPort,
  type SupportedMarketNetwork,
  type TokenMetadataSnapshot,
} from '../../domain/market-provider.port';
import { withMarketSpan } from '../../domain/otel';
import { MarketProviderRegistry } from '../../infrastructure/providers/provider-registry';
import { REDIS_PORT, type RedisPort } from '../../infrastructure/redis/redis.port';
import { SimulatorMarketProvider } from '../../infrastructure/providers/simulator-market.provider';

@Injectable()
export class TokenMetadataService {
  private readonly logger = new Logger(TokenMetadataService.name);

  constructor(
    @Inject(ENV) private readonly env: ServiceEnv,
    @Inject(MARKET_DATA_PROVIDER) private readonly provider: MarketDataProviderPort,
    @Inject(REDIS_PORT) private readonly redis: RedisPort,
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(MarketProviderRegistry) private readonly registry: MarketProviderRegistry,
    @Inject(SimulatorMarketProvider) private readonly simulator: SimulatorMarketProvider,
  ) {}

  async getMetadata(
    symbol: string,
    network: SupportedMarketNetwork,
  ): Promise<TokenMetadataSnapshot | null> {
    const cacheKey = `md:meta:${network}:${symbol.toUpperCase()}`;
    const cached = await this.redis.get(cacheKey);
    if (cached) {
      this.registry.metrics.cacheHits += 1;
      return JSON.parse(cached) as TokenMetadataSnapshot;
    }
    this.registry.metrics.cacheMisses += 1;

    try {
      const row = await this.prisma.assetMarketMetadata.findFirst({
        where: { symbol: symbol.toUpperCase(), network: network as ChainNetwork },
      });
      if (row) {
        const snap = this.toSnapshot(row);
        await this.redis.set(
          cacheKey,
          JSON.stringify(snap),
          this.env.MARKET_DATA_METADATA_CACHE_TTL_SECONDS,
        );
        return snap;
      }
    } catch (error) {
      this.logger.debug(
        `metadata DB lookup skipped: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    const fromProvider = await this.provider.getTokenMetadata(symbol, network);
    if (fromProvider) {
      await this.upsert(fromProvider);
      await this.redis.set(
        cacheKey,
        JSON.stringify(fromProvider),
        this.env.MARKET_DATA_METADATA_CACHE_TTL_SECONDS,
      );
    }
    return fromProvider;
  }

  async syncNativeMetadata(): Promise<number> {
    return withMarketSpan('market.metadata.sync', { provider: this.provider.code }, async () => {
      let count = 0;
      for (const seed of this.simulator.listSeeds()) {
        // In real mode (simulator disabled) never persist simulator-sourced
        // metadata; only upsert what the real provider returns.
        const meta =
          (await this.provider.getTokenMetadata(seed.symbol, seed.network)) ??
          (this.env.MARKET_DATA_SIMULATOR_ENABLED
            ? await this.simulator.getTokenMetadata(seed.symbol, seed.network)
            : null);
        if (meta) {
          await this.upsert(meta);
          count += 1;
        }
      }
      return count;
    });
  }

  private async upsert(meta: TokenMetadataSnapshot): Promise<void> {
    try {
      await this.prisma.assetMarketMetadata.upsert({
        where: {
          network_symbol_contractAddress: {
            network: meta.network as ChainNetwork,
            symbol: meta.symbol,
            contractAddress: meta.contractAddress ?? '',
          },
        },
        create: {
          network: meta.network as ChainNetwork,
          symbol: meta.symbol,
          name: meta.name,
          logoUrl: meta.logoUrl,
          decimals: meta.decimals,
          contractAddress: meta.contractAddress ?? '',
          tokenType: (meta.tokenType as AssetStandard) || AssetStandard.NATIVE,
          verificationStatus: meta.verificationStatus as MarketTokenVerification,
          circulatingSupply: meta.circulatingSupply ?? undefined,
          totalSupply: meta.totalSupply ?? undefined,
          maxSupply: meta.maxSupply ?? undefined,
          externalIds: meta.externalIds,
          syncedAt: new Date(),
        },
        update: {
          name: meta.name,
          logoUrl: meta.logoUrl,
          decimals: meta.decimals,
          verificationStatus: meta.verificationStatus as MarketTokenVerification,
          circulatingSupply: meta.circulatingSupply ?? undefined,
          totalSupply: meta.totalSupply ?? undefined,
          maxSupply: meta.maxSupply ?? undefined,
          externalIds: meta.externalIds,
          syncedAt: new Date(),
        },
      });
    } catch (error) {
      this.logger.debug(
        `metadata upsert skipped: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  private toSnapshot(row: {
    symbol: string;
    name: string;
    network: ChainNetwork;
    logoUrl: string | null;
    decimals: number;
    contractAddress: string | null;
    tokenType: AssetStandard;
    verificationStatus: MarketTokenVerification;
    circulatingSupply: { toString(): string } | null;
    totalSupply: { toString(): string } | null;
    maxSupply: { toString(): string } | null;
    externalIds: unknown;
  }): TokenMetadataSnapshot {
    return {
      symbol: row.symbol,
      name: row.name,
      network: row.network as SupportedMarketNetwork,
      logoUrl: row.logoUrl,
      decimals: row.decimals,
      contractAddress: row.contractAddress || null,
      tokenType: row.tokenType,
      verificationStatus: row.verificationStatus,
      circulatingSupply: row.circulatingSupply?.toString() ?? null,
      totalSupply: row.totalSupply?.toString() ?? null,
      maxSupply: row.maxSupply?.toString() ?? null,
      externalIds: (row.externalIds as Record<string, string>) ?? {},
    };
  }
}
