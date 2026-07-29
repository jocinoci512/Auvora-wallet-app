import { Module } from '@nestjs/common';
import { PrismaModule } from '@auvora/database';
import { ConfigModule } from '../config/config.module';
import { ENV, type ServiceEnv } from '../config/env.schema';
import { CLOCK, ID_GENERATOR, RATE_LIMITER } from '../application/ports/clock.port';
import { CHARGEBACK_REPOSITORY } from '../application/ports/chargeback-repository.port';
import { DISPUTE_REPOSITORY } from '../application/ports/dispute-repository.port';
import { EVENT_LOG_REPOSITORY } from '../application/ports/event-log-repository.port';
import { LIMIT_REPOSITORY } from '../application/ports/limit-repository.port';
import { PAYMENT_METHOD_REPOSITORY } from '../application/ports/payment-method-repository.port';
import { PAYMENT_REPOSITORY } from '../application/ports/payment-repository.port';
import { PROVIDER_FACTORY, PROVIDER_RESOLVER } from '../application/ports/provider-factory.port';
import { PROVIDER_HEALTH_REPOSITORY } from '../application/ports/provider-health-repository.port';
import { PROVIDER_RECORD_REPOSITORY } from '../application/ports/provider-record-repository.port';
import { RECONCILIATION_REPOSITORY } from '../application/ports/reconciliation-repository.port';
import { REFUND_REPOSITORY } from '../application/ports/refund-repository.port';
import {
  SETTLEMENT_BATCH_REPOSITORY,
  SETTLEMENT_REPOSITORY,
} from '../application/ports/settlement-repository.port';
import { WALLET_LEDGER } from '../application/ports/wallet-ledger.port';
import { EVENT_BUS, FRAUD_HOOK } from '../domain';
import { EventBusService } from './events/event-bus.service';
import { NoopFraudHookAdapter } from './fraud/noop-fraud-hook.adapter';
import { ComplianceFraudHttpClient } from './fraud/compliance-fraud-http.client';
import { LoggerInfrastructureModule } from './logging/logger.module';
import { AI_PUBLISHER, AiPublisherAdapter } from './ai/ai-publisher.adapter';
import {
  ANALYTICS_PUBLISHER,
  AnalyticsPublisherAdapter,
} from './analytics/analytics-publisher.adapter';
import {
  OBSERVABILITY_PUBLISHER,
  ObservabilityPublisherAdapter,
} from './observability/observability-publisher.adapter';
import {
  NOTIFICATIONS_PUBLISHER,
  NotificationsPublisherAdapter,
} from './notifications/notifications-publisher.adapter';
import { PrismaChargebackRepository } from './persistence/prisma-chargeback.repository';
import { PrismaDisputeRepository } from './persistence/prisma-dispute.repository';
import { PrismaEventLogRepository } from './persistence/prisma-event-log.repository';
import { PrismaLimitRepository } from './persistence/prisma-limit.repository';
import { PrismaPaymentMethodRepository } from './persistence/prisma-payment-method.repository';
import { PrismaPaymentRepository } from './persistence/prisma-payment.repository';
import { PrismaProviderHealthRepository } from './persistence/prisma-provider-health.repository';
import { PrismaProviderRecordRepository } from './persistence/prisma-provider-record.repository';
import { PrismaReconciliationRepository } from './persistence/prisma-reconciliation.repository';
import { PrismaRefundRepository } from './persistence/prisma-refund.repository';
import {
  PrismaSettlementBatchRepository,
  PrismaSettlementRepository,
} from './persistence/prisma-settlement.repository';
import {
  PAYMENT_PROVIDERS,
  PROVIDER_REGISTRY,
  type ProviderRegistry,
} from './providers/provider-registry';
import { ProviderFactory } from './providers/provider-factory.service';
import { ProviderHealthMonitor } from './providers/provider-health-monitor.service';
import { ProviderResolver } from './providers/provider-resolver.service';
import { RedisAdapter } from './redis/redis.adapter';
import { REDIS_PORT } from './redis/redis.port';
import { SystemClockAdapter, UuidIdGeneratorAdapter } from './system/system.adapters';
import { WalletLedgerHttpClient } from './wallet/wallet-ledger-http.client';

@Module({
  imports: [ConfigModule, PrismaModule, LoggerInfrastructureModule],
  providers: [
    RedisAdapter,
    SystemClockAdapter,
    UuidIdGeneratorAdapter,
    WalletLedgerHttpClient,
    NoopFraudHookAdapter,
    ComplianceFraudHttpClient,
    NotificationsPublisherAdapter,
    AiPublisherAdapter,
    AnalyticsPublisherAdapter,
    ObservabilityPublisherAdapter,
    PrismaPaymentRepository,
    PrismaPaymentMethodRepository,
    PrismaProviderRecordRepository,
    PrismaProviderHealthRepository,
    PrismaEventLogRepository,
    PrismaSettlementRepository,
    PrismaSettlementBatchRepository,
    PrismaLimitRepository,
    PrismaReconciliationRepository,
    PrismaRefundRepository,
    PrismaDisputeRepository,
    PrismaChargebackRepository,
    ...PAYMENT_PROVIDERS,
    ProviderFactory,
    ProviderResolver,
    ProviderHealthMonitor,
    EventBusService,
    {
      provide: PROVIDER_REGISTRY,
      useFactory: (...providers: InstanceType<(typeof PAYMENT_PROVIDERS)[number]>[]) => {
        const registry: ProviderRegistry = new Map();
        for (const provider of providers) {
          registry.set(provider.getCode(), provider);
        }
        return registry;
      },
      inject: [...PAYMENT_PROVIDERS],
    },
    { provide: REDIS_PORT, useExisting: RedisAdapter },
    { provide: RATE_LIMITER, useExisting: RedisAdapter },
    { provide: CLOCK, useExisting: SystemClockAdapter },
    { provide: ID_GENERATOR, useExisting: UuidIdGeneratorAdapter },
    { provide: WALLET_LEDGER, useExisting: WalletLedgerHttpClient },
    {
      provide: FRAUD_HOOK,
      useFactory: (env: ServiceEnv, http: ComplianceFraudHttpClient, noop: NoopFraudHookAdapter) =>
        env.COMPLIANCE_SERVICE_URL ? http : noop,
      inject: [ENV, ComplianceFraudHttpClient, NoopFraudHookAdapter],
    },
    { provide: PAYMENT_REPOSITORY, useExisting: PrismaPaymentRepository },
    { provide: PAYMENT_METHOD_REPOSITORY, useExisting: PrismaPaymentMethodRepository },
    { provide: PROVIDER_RECORD_REPOSITORY, useExisting: PrismaProviderRecordRepository },
    { provide: PROVIDER_HEALTH_REPOSITORY, useExisting: PrismaProviderHealthRepository },
    { provide: EVENT_LOG_REPOSITORY, useExisting: PrismaEventLogRepository },
    { provide: SETTLEMENT_REPOSITORY, useExisting: PrismaSettlementRepository },
    { provide: SETTLEMENT_BATCH_REPOSITORY, useExisting: PrismaSettlementBatchRepository },
    { provide: LIMIT_REPOSITORY, useExisting: PrismaLimitRepository },
    { provide: RECONCILIATION_REPOSITORY, useExisting: PrismaReconciliationRepository },
    { provide: REFUND_REPOSITORY, useExisting: PrismaRefundRepository },
    { provide: DISPUTE_REPOSITORY, useExisting: PrismaDisputeRepository },
    { provide: CHARGEBACK_REPOSITORY, useExisting: PrismaChargebackRepository },
    { provide: PROVIDER_FACTORY, useExisting: ProviderFactory },
    { provide: PROVIDER_RESOLVER, useExisting: ProviderResolver },
    { provide: EVENT_BUS, useExisting: EventBusService },
    { provide: NOTIFICATIONS_PUBLISHER, useExisting: NotificationsPublisherAdapter },
    { provide: AI_PUBLISHER, useExisting: AiPublisherAdapter },
    { provide: ANALYTICS_PUBLISHER, useExisting: AnalyticsPublisherAdapter },
    { provide: OBSERVABILITY_PUBLISHER, useExisting: ObservabilityPublisherAdapter },
  ],
  exports: [
    REDIS_PORT,
    RATE_LIMITER,
    CLOCK,
    ID_GENERATOR,
    WALLET_LEDGER,
    FRAUD_HOOK,
    PAYMENT_REPOSITORY,
    PAYMENT_METHOD_REPOSITORY,
    PROVIDER_RECORD_REPOSITORY,
    PROVIDER_HEALTH_REPOSITORY,
    EVENT_LOG_REPOSITORY,
    SETTLEMENT_REPOSITORY,
    SETTLEMENT_BATCH_REPOSITORY,
    LIMIT_REPOSITORY,
    RECONCILIATION_REPOSITORY,
    REFUND_REPOSITORY,
    DISPUTE_REPOSITORY,
    CHARGEBACK_REPOSITORY,
    PROVIDER_FACTORY,
    PROVIDER_RESOLVER,
    EVENT_BUS,
    NOTIFICATIONS_PUBLISHER,
    AI_PUBLISHER,
    ANALYTICS_PUBLISHER,
    OBSERVABILITY_PUBLISHER,
    LoggerInfrastructureModule,
    PrismaModule,
  ],
})
export class InfrastructureModule {}
