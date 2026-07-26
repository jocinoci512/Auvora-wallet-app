import { Module } from '@nestjs/common';
import { InfrastructureModule } from '../infrastructure/infrastructure.module';
import { AuditService } from './services/audit.service';
import { AutomationService } from './services/automation.service';
import { ChatService } from './services/chat.service';
import { ConversationService } from './services/conversation.service';
import { CostService } from './services/cost.service';
import { DashboardService } from './services/dashboard.service';
import { EmbeddingService } from './services/embedding.service';
import { KnowledgeService } from './services/knowledge.service';
import { ModelRouterService } from './services/model-router.service';
import { PromptService } from './services/prompt.service';
import { UsageService } from './services/usage.service';
import { VectorSearchService } from './services/vector-search.service';

const SERVICES = [
  AuditService,
  ModelRouterService,
  PromptService,
  ConversationService,
  EmbeddingService,
  VectorSearchService,
  KnowledgeService,
  ChatService,
  UsageService,
  CostService,
  DashboardService,
  AutomationService,
];

@Module({
  imports: [InfrastructureModule],
  providers: [...SERVICES],
  exports: [...SERVICES],
})
export class ApplicationModule {}
