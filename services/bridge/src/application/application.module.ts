import { Module } from '@nestjs/common';
import { InfrastructureModule } from '../infrastructure/infrastructure.module';
import { BridgeDashboardService } from './services/bridge-dashboard.service';
import { BridgeEngineService } from './services/bridge-engine.service';
import { BridgeWorkersService } from './services/bridge-workers.service';

@Module({
  imports: [InfrastructureModule],
  providers: [BridgeEngineService, BridgeDashboardService, BridgeWorkersService],
  exports: [BridgeEngineService, BridgeDashboardService, BridgeWorkersService],
})
export class ApplicationModule {}
