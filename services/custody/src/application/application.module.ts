import { Module } from '@nestjs/common';
import { InfrastructureModule } from '../infrastructure/infrastructure.module';
import { ApprovalService } from './services/approval.service';
import { DashboardService } from './services/dashboard.service';
import { KeyService } from './services/key.service';
import { PolicyService } from './services/policy.service';
import { RecoveryService } from './services/recovery.service';
import { SignerGroupService } from './services/signer-group.service';
import { SigningService } from './services/signing.service';

const SERVICES = [
  KeyService,
  PolicyService,
  SigningService,
  ApprovalService,
  RecoveryService,
  SignerGroupService,
  DashboardService,
];

@Module({
  imports: [InfrastructureModule],
  providers: [...SERVICES],
  exports: [...SERVICES],
})
export class ApplicationModule {}
