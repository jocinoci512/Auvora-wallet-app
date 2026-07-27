import { Module } from '@nestjs/common';
import { InfrastructureModule } from '../infrastructure/infrastructure.module';
import { AdminMetricsService } from './services/admin-metrics.service';
import { AdminQueryService } from './services/admin-query.service';
import { BlockchainService } from './services/blockchain.service';
import { ConfirmationEngine } from './services/confirmation-engine.service';
import { FeeEngine } from './services/fee-engine.service';
import { ProviderRpcHealthService } from './services/provider-rpc-health.service';
import { SyncService } from './services/sync.service';
import { TransactionEngine } from './services/transaction-engine.service';

const SERVICES = [
  BlockchainService,
  TransactionEngine,
  ConfirmationEngine,
  FeeEngine,
  SyncService,
  AdminMetricsService,
  AdminQueryService,
  ProviderRpcHealthService,
];

@Module({
  imports: [InfrastructureModule],
  providers: [...SERVICES],
  exports: [...SERVICES],
})
export class ApplicationModule {}
