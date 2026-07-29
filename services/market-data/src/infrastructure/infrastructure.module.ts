import { Module } from '@nestjs/common';
import { PrismaModule } from '@auvora/database';
import { ConfigModule } from '../config/config.module';
import { CLOCK, ID_GENERATOR, RATE_LIMITER } from '../application/ports/clock.port';
import { MARKET_DATA_PROVIDER } from '../domain/market-provider.port';
import {
  ANALYTICS_PUBLISHER,
  AnalyticsPublisherAdapter,
} from './analytics/analytics-publisher.adapter';
import { AesFieldEncryptionAdapter, FIELD_ENCRYPTION } from './crypto/field-encryption.adapter';
import { LoggerInfrastructureModule } from './logging/logger.module';
import {
  NOTIFICATIONS_PUBLISHER,
  NotificationsPublisherAdapter,
} from './notifications/notifications-publisher.adapter';
import {
  OBSERVABILITY_PUBLISHER,
  ObservabilityPublisherAdapter,
} from './observability/observability-publisher.adapter';
import { CoinGeckoMarketProvider } from './providers/coingecko.provider';
import { MarketProviderRegistry } from './providers/provider-registry';
import { SimulatorMarketProvider } from './providers/simulator-market.provider';
import { RedisAdapter } from './redis/redis.adapter';
import { REDIS_PORT } from './redis/redis.port';
import { SystemClockAdapter, UuidIdGeneratorAdapter } from './system/system.adapters';
import { WALLET_HTTP_CLIENT, WalletHttpClientAdapter } from './wallet/wallet-http.client';

@Module({
  imports: [ConfigModule, PrismaModule, LoggerInfrastructureModule],
  providers: [
    RedisAdapter,
    SystemClockAdapter,
    UuidIdGeneratorAdapter,
    AesFieldEncryptionAdapter,
    ObservabilityPublisherAdapter,
    NotificationsPublisherAdapter,
    AnalyticsPublisherAdapter,
    WalletHttpClientAdapter,
    SimulatorMarketProvider,
    CoinGeckoMarketProvider,
    MarketProviderRegistry,
    { provide: REDIS_PORT, useExisting: RedisAdapter },
    { provide: RATE_LIMITER, useExisting: RedisAdapter },
    { provide: CLOCK, useExisting: SystemClockAdapter },
    { provide: ID_GENERATOR, useExisting: UuidIdGeneratorAdapter },
    { provide: FIELD_ENCRYPTION, useExisting: AesFieldEncryptionAdapter },
    { provide: OBSERVABILITY_PUBLISHER, useExisting: ObservabilityPublisherAdapter },
    { provide: NOTIFICATIONS_PUBLISHER, useExisting: NotificationsPublisherAdapter },
    { provide: ANALYTICS_PUBLISHER, useExisting: AnalyticsPublisherAdapter },
    { provide: WALLET_HTTP_CLIENT, useExisting: WalletHttpClientAdapter },
    { provide: MARKET_DATA_PROVIDER, useExisting: MarketProviderRegistry },
  ],
  exports: [
    REDIS_PORT,
    RATE_LIMITER,
    CLOCK,
    ID_GENERATOR,
    FIELD_ENCRYPTION,
    OBSERVABILITY_PUBLISHER,
    NOTIFICATIONS_PUBLISHER,
    ANALYTICS_PUBLISHER,
    WALLET_HTTP_CLIENT,
    MARKET_DATA_PROVIDER,
    MarketProviderRegistry,
    SimulatorMarketProvider,
    LoggerInfrastructureModule,
    PrismaModule,
  ],
})
export class InfrastructureModule {}
