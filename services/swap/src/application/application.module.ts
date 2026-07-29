import { Module } from '@nestjs/common';
import { InfrastructureModule } from '../infrastructure/infrastructure.module';
import { RoutingEngineService } from './services/routing-engine.service';
import { SwapDashboardService } from './services/swap-dashboard.service';
import { SwapEngineService } from './services/swap-engine.service';
import { SwapExecutionService } from './services/swap-execution.service';
import { SwapWorkersService } from './services/swap-workers.service';

@Module({
  imports: [InfrastructureModule],
  providers: [
    RoutingEngineService,
    SwapExecutionService,
    SwapEngineService,
    SwapDashboardService,
    SwapWorkersService,
  ],
  exports: [
    RoutingEngineService,
    SwapExecutionService,
    SwapEngineService,
    SwapDashboardService,
    SwapWorkersService,
  ],
})
export class ApplicationModule {}
