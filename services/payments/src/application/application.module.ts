import { Module } from '@nestjs/common';
import { InfrastructureModule } from '../infrastructure/infrastructure.module';
import { AdminPaymentsService } from './services/admin-payments.service';
import { LimitsService } from './services/limits.service';
import { PaymentMethodsService } from './services/payment-methods.service';
import { PaymentOrchestratorService } from './services/payment-orchestrator.service';
import { ReconciliationEngineService } from './services/reconciliation-engine.service';
import { SettlementEngineService } from './services/settlement-engine.service';

const SERVICES = [
  LimitsService,
  PaymentOrchestratorService,
  SettlementEngineService,
  ReconciliationEngineService,
  AdminPaymentsService,
  PaymentMethodsService,
];

@Module({
  imports: [InfrastructureModule],
  providers: [...SERVICES],
  exports: [...SERVICES],
})
export class ApplicationModule {}
