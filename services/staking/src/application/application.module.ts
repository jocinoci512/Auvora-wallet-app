import { Module } from '@nestjs/common';
import { InfrastructureModule } from '../infrastructure/infrastructure.module';
import { StakingDashboardService } from './services/staking-dashboard.service';
import { StakingEngineService } from './services/staking-engine.service';
import { StakingWorkersService } from './services/staking-workers.service';

@Module({
  imports: [InfrastructureModule],
  providers: [StakingEngineService, StakingDashboardService, StakingWorkersService],
  exports: [StakingEngineService, StakingDashboardService, StakingWorkersService],
})
export class ApplicationModule {}
