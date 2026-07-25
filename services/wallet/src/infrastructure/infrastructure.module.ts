import { Module } from '@nestjs/common';
import { PrismaModule } from '@auvora/database';
import { ConfigModule } from '../config/config.module';
import { CLOCK, ID_GENERATOR, RATE_LIMITER } from '../application/ports/clock.port';
import { LEDGER_REPOSITORY, TRANSACTION_REPOSITORY } from '../application/ports/ledger-repository.port';
import { WALLET_REPOSITORY } from '../application/ports/wallet-repository.port';
import {
  BLOCKCHAIN_PROVIDER_REGISTRY,
  BLOCKCHAIN_PROVIDERS,
  type BlockchainProviderRegistry,
} from './blockchain/blockchain-providers';
import { PrismaLedgerRepository } from './persistence/prisma-ledger.repository';
import { PrismaTransactionRepository } from './persistence/prisma-transaction.repository';
import { PrismaWalletRepository } from './persistence/prisma-wallet.repository';
import { LoggerInfrastructureModule } from './logging/logger.module';
import { REDIS_PORT } from './redis/redis.port';
import { RedisAdapter } from './redis/redis.adapter';
import { SystemClockAdapter, UuidIdGeneratorAdapter } from './system/system.adapters';

@Module({
  imports: [ConfigModule, PrismaModule, LoggerInfrastructureModule],
  providers: [
    RedisAdapter,
    SystemClockAdapter,
    UuidIdGeneratorAdapter,
    PrismaWalletRepository,
    PrismaLedgerRepository,
    PrismaTransactionRepository,
    ...BLOCKCHAIN_PROVIDERS,
    {
      provide: BLOCKCHAIN_PROVIDER_REGISTRY,
      useFactory: (...providers: InstanceType<(typeof BLOCKCHAIN_PROVIDERS)[number]>[]) => {
        const registry: BlockchainProviderRegistry = new Map();
        for (const provider of providers) {
          registry.set(provider.getChain(), provider);
        }
        return registry;
      },
      inject: [...BLOCKCHAIN_PROVIDERS],
    },
    {
      provide: REDIS_PORT,
      useExisting: RedisAdapter,
    },
    {
      provide: RATE_LIMITER,
      useExisting: RedisAdapter,
    },
    {
      provide: CLOCK,
      useExisting: SystemClockAdapter,
    },
    {
      provide: ID_GENERATOR,
      useExisting: UuidIdGeneratorAdapter,
    },
    {
      provide: WALLET_REPOSITORY,
      useExisting: PrismaWalletRepository,
    },
    {
      provide: LEDGER_REPOSITORY,
      useExisting: PrismaLedgerRepository,
    },
    {
      provide: TRANSACTION_REPOSITORY,
      useExisting: PrismaTransactionRepository,
    },
  ],
  exports: [
    REDIS_PORT,
    RATE_LIMITER,
    CLOCK,
    ID_GENERATOR,
    WALLET_REPOSITORY,
    LEDGER_REPOSITORY,
    TRANSACTION_REPOSITORY,
    BLOCKCHAIN_PROVIDER_REGISTRY,
    LoggerInfrastructureModule,
    PrismaModule,
  ],
})
export class InfrastructureModule {}
