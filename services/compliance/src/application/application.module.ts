import { Module } from '@nestjs/common';
import { InfrastructureModule } from '../infrastructure/infrastructure.module';
import { CaseService } from './services/case.service';
import { DashboardService } from './services/dashboard.service';
import { KycService } from './services/kyc.service';
import { PolicyGateService } from './services/policy-gate.service';
import { RiskService } from './services/risk.service';
import { RulesEngineService } from './services/rules-engine.service';
import { RulesService } from './services/rules.service';

const SERVICES = [
  RulesEngineService,
  KycService,
  RiskService,
  PolicyGateService,
  CaseService,
  RulesService,
  DashboardService,
];

@Module({
  imports: [InfrastructureModule],
  providers: [...SERVICES],
  exports: [...SERVICES],
})
export class ApplicationModule {}
