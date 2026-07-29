import { Module } from '@nestjs/common';
import { InfrastructureModule } from '../infrastructure/infrastructure.module';
import { ConnectionsDashboardService } from './services/connections-dashboard.service';
import { ConnectionsEngineService } from './services/connections-engine.service';
import { ConnectionsWorkersService } from './services/connections-workers.service';
import { DappPlatformService } from './services/dapp-platform.service';

@Module({
  imports: [InfrastructureModule],
  providers: [
    ConnectionsEngineService,
    DappPlatformService,
    ConnectionsDashboardService,
    ConnectionsWorkersService,
  ],
  exports: [
    ConnectionsEngineService,
    DappPlatformService,
    ConnectionsDashboardService,
    ConnectionsWorkersService,
  ],
})
export class ApplicationModule {}
