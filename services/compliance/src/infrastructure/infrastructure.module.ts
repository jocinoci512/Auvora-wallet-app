import { Module } from '@nestjs/common';
import { PrismaModule } from '@auvora/database';
import { ConfigModule } from '../config/config.module';
import { loadEnv } from '../config/env.schema';
import { CLOCK, ID_GENERATOR, RATE_LIMITER } from '../application/ports/clock.port';
import {
  ADDRESS_RISK_PROVIDER,
  BLOCKCHAIN_ANALYTICS_PROVIDER,
  DOCUMENT_VERIFICATION_PROVIDER,
  FRAUD_PROVIDER,
  IDENTITY_VERIFICATION_PROVIDER,
  PEP_PROVIDER,
  RISK_SCORING_PROVIDER,
  SANCTIONS_PROVIDER,
  TRAVEL_RULE_PROVIDER,
} from '../application/ports/provider.tokens';
import { EVENT_BUS } from '../domain';
import { AesFieldEncryptionAdapter, FIELD_ENCRYPTION } from './crypto/field-encryption.adapter';
import { EventBusService } from './events/event-bus.service';
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
import {
  AddressRiskSimulatorProvider,
  BlockchainAnalyticsSimulatorProvider,
  COMPLIANCE_SIMULATOR_PROVIDERS,
  DocumentSimulatorProvider,
  FraudSimulatorProvider,
  IdentitySimulatorProvider,
  PepSimulatorProvider,
  RiskScoringSimulatorProvider,
  SanctionsSimulatorProvider,
  TravelRuleSimulatorProvider,
} from './providers/simulators';
import {
  LocalRiskScoringProvider,
  UnavailableAddressRiskProvider,
  UnavailableBlockchainAnalyticsProvider,
  UnavailableDocumentProvider,
  UnavailableFraudProvider,
  UnavailableIdentityProvider,
  UnavailablePepProvider,
  UnavailableSanctionsProvider,
  UnavailableTravelRuleProvider,
} from './providers/unavailable.providers';
import { RedisAdapter } from './redis/redis.adapter';
import { REDIS_PORT } from './redis/redis.port';
import { SystemClockAdapter, UuidIdGeneratorAdapter } from './system/system.adapters';

const env = loadEnv();

const providerBindings = env.COMPLIANCE_SIMULATOR_ENABLED
  ? [
      ...COMPLIANCE_SIMULATOR_PROVIDERS,
      { provide: IDENTITY_VERIFICATION_PROVIDER, useExisting: IdentitySimulatorProvider },
      { provide: DOCUMENT_VERIFICATION_PROVIDER, useExisting: DocumentSimulatorProvider },
      { provide: SANCTIONS_PROVIDER, useExisting: SanctionsSimulatorProvider },
      { provide: PEP_PROVIDER, useExisting: PepSimulatorProvider },
      { provide: ADDRESS_RISK_PROVIDER, useExisting: AddressRiskSimulatorProvider },
      { provide: BLOCKCHAIN_ANALYTICS_PROVIDER, useExisting: BlockchainAnalyticsSimulatorProvider },
      { provide: FRAUD_PROVIDER, useExisting: FraudSimulatorProvider },
      { provide: RISK_SCORING_PROVIDER, useExisting: RiskScoringSimulatorProvider },
      { provide: TRAVEL_RULE_PROVIDER, useExisting: TravelRuleSimulatorProvider },
    ]
  : [
      UnavailableIdentityProvider,
      UnavailableDocumentProvider,
      UnavailableSanctionsProvider,
      UnavailablePepProvider,
      UnavailableAddressRiskProvider,
      UnavailableBlockchainAnalyticsProvider,
      UnavailableFraudProvider,
      LocalRiskScoringProvider,
      UnavailableTravelRuleProvider,
      { provide: IDENTITY_VERIFICATION_PROVIDER, useExisting: UnavailableIdentityProvider },
      { provide: DOCUMENT_VERIFICATION_PROVIDER, useExisting: UnavailableDocumentProvider },
      { provide: SANCTIONS_PROVIDER, useExisting: UnavailableSanctionsProvider },
      { provide: PEP_PROVIDER, useExisting: UnavailablePepProvider },
      { provide: ADDRESS_RISK_PROVIDER, useExisting: UnavailableAddressRiskProvider },
      {
        provide: BLOCKCHAIN_ANALYTICS_PROVIDER,
        useExisting: UnavailableBlockchainAnalyticsProvider,
      },
      { provide: FRAUD_PROVIDER, useExisting: UnavailableFraudProvider },
      { provide: RISK_SCORING_PROVIDER, useExisting: LocalRiskScoringProvider },
      { provide: TRAVEL_RULE_PROVIDER, useExisting: UnavailableTravelRuleProvider },
    ];

@Module({
  imports: [ConfigModule, PrismaModule, LoggerInfrastructureModule],
  providers: [
    RedisAdapter,
    SystemClockAdapter,
    UuidIdGeneratorAdapter,
    AesFieldEncryptionAdapter,
    EventBusService,
    NotificationsPublisherAdapter,
    AiPublisherAdapter,
    AnalyticsPublisherAdapter,
    ObservabilityPublisherAdapter,
    ...providerBindings,
    { provide: REDIS_PORT, useExisting: RedisAdapter },
    { provide: RATE_LIMITER, useExisting: RedisAdapter },
    { provide: CLOCK, useExisting: SystemClockAdapter },
    { provide: ID_GENERATOR, useExisting: UuidIdGeneratorAdapter },
    { provide: FIELD_ENCRYPTION, useExisting: AesFieldEncryptionAdapter },
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
    FIELD_ENCRYPTION,
    EVENT_BUS,
    NOTIFICATIONS_PUBLISHER,
    AI_PUBLISHER,
    ANALYTICS_PUBLISHER,
    OBSERVABILITY_PUBLISHER,
    IDENTITY_VERIFICATION_PROVIDER,
    DOCUMENT_VERIFICATION_PROVIDER,
    SANCTIONS_PROVIDER,
    PEP_PROVIDER,
    ADDRESS_RISK_PROVIDER,
    BLOCKCHAIN_ANALYTICS_PROVIDER,
    FRAUD_PROVIDER,
    RISK_SCORING_PROVIDER,
    TRAVEL_RULE_PROVIDER,
    LoggerInfrastructureModule,
    PrismaModule,
  ],
})
export class InfrastructureModule {}
