import { Module } from '@nestjs/common';
import { InfrastructureModule } from '../infrastructure/infrastructure.module';
import { BroadcastService } from './services/broadcast.service';
import { DashboardService } from './services/dashboard.service';
import { NotificationService } from './services/notification.service';
import { PreferenceService } from './services/preference.service';
import { QueueService } from './services/queue.service';
import { QueueWorkerService } from './services/queue-worker.service';
import { TemplateService } from './services/template.service';
import { WebhookService } from './services/webhook.service';
import { WebhookRetryWorkerService } from './services/webhook-retry-worker.service';

const SERVICES = [
  TemplateService,
  PreferenceService,
  QueueService,
  NotificationService,
  WebhookService,
  DashboardService,
  BroadcastService,
];

@Module({
  imports: [InfrastructureModule],
  providers: [...SERVICES, QueueWorkerService, WebhookRetryWorkerService],
  exports: [...SERVICES],
})
export class ApplicationModule {}
