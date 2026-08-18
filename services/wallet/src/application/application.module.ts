import { Module } from '@nestjs/common';
import { InfrastructureModule } from '../infrastructure/infrastructure.module';
import { PortfolioEngineService } from './services/portfolio-engine.service';
import { AdminSimulationService } from './services/admin-simulation.service';
import { WalletEngineService } from './services/wallet-engine.service';
import { WalletRetryQueue } from './services/wallet-retry.queue';
import { TransferPrepareService } from './services/transfer-prepare.service';
import { WalletService } from './services/wallet.service';
import { WalletSyncService } from './services/wallet-sync.service';
import { WalletWorkersService } from './services/wallet-workers.service';

const SERVICES = [
  WalletService,
  TransferPrepareService,
  AdminSimulationService,
  WalletEngineService,
  PortfolioEngineService,
  WalletSyncService,
  WalletRetryQueue,
  WalletWorkersService,
];

@Module({
  imports: [InfrastructureModule],
  providers: [...SERVICES],
  exports: [...SERVICES],
})
export class ApplicationModule {}
