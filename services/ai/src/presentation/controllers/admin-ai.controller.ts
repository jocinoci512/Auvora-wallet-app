import { Body, Controller, Get, Inject, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { AiAssistantType, AiKnowledgeSourceType, AiPromptCategory } from '@auvora/database';
import type { JwtAccessClaims } from '@auvora/types';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Max,
  Min,
  MinLength,
} from 'class-validator';
import { ConversationService } from '../../application/services/conversation.service';
import { DashboardService } from '../../application/services/dashboard.service';
import { KnowledgeService } from '../../application/services/knowledge.service';
import { ModelRouterService } from '../../application/services/model-router.service';
import { PromptService } from '../../application/services/prompt.service';
import { UsageService } from '../../application/services/usage.service';
import {
  ALL_AI_PROVIDER_TYPES,
  PERMISSION_AI_ADMIN,
  PERMISSION_AI_KNOWLEDGE,
  PERMISSION_AI_PROMPTS,
  ADMIN_PORTAL_ROLES,
  type AiProviderTypeCode,
} from '../../domain';
import { successResponse } from '@auvora/nest-common';
import { Permissions, Roles } from '../decorators/auth.decorators';
import { CurrentUser } from '../decorators/current-user.decorator';

export class PageQueryDto {
  @IsOptional()
  @IsInt()
  @Min(0)
  skip?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(200)
  take?: number;
}

export class CreatePromptTemplateDto {
  @IsString()
  @MinLength(2)
  code!: string;

  @IsString()
  @MinLength(2)
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsString()
  category!: AiPromptCategory;

  @IsOptional()
  @IsString()
  systemPrompt?: string;

  @IsString()
  @MinLength(1)
  userPrompt!: string;

  @IsOptional()
  @IsObject()
  variables?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  modelHint?: string;

  @IsOptional()
  @IsNumber()
  temperature?: number;

  @IsOptional()
  @IsInt()
  maxTokens?: number;
}

export class CreatePromptVersionDto {
  @IsOptional()
  @IsString()
  systemPrompt?: string;

  @IsString()
  @MinLength(1)
  userPrompt!: string;

  @IsOptional()
  @IsObject()
  variables?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  modelHint?: string;

  @IsOptional()
  @IsNumber()
  temperature?: number;

  @IsOptional()
  @IsInt()
  maxTokens?: number;

  @IsOptional()
  @IsString()
  changeNotes?: string;
}

export class PreviewPromptDto {
  @IsOptional()
  @IsObject()
  variables?: Record<string, unknown>;
}

export class RollbackPromptDto {
  @IsInt()
  @Min(1)
  toVersion!: number;
}

export class CreateKnowledgeSourceDto {
  @IsString()
  @MinLength(2)
  code!: string;

  @IsString()
  @MinLength(2)
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsString()
  sourceType!: AiKnowledgeSourceType;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

export class IngestDocumentDto {
  @IsString()
  @MinLength(1)
  title!: string;

  @IsString()
  @MinLength(1)
  content!: string;

  @IsOptional()
  @IsString()
  contentType?: string;

  @IsOptional()
  @IsInt()
  chunkSize?: number;

  @IsOptional()
  @IsInt()
  chunkOverlap?: number;
}

export class UpsertProviderDto {
  @IsString()
  @MinLength(2)
  code!: string;

  @IsString()
  @MinLength(2)
  name!: string;

  @IsIn(ALL_AI_PROVIDER_TYPES)
  providerType!: AiProviderTypeCode;

  @IsInt()
  @Min(0)
  priority!: number;

  @IsOptional()
  @IsString()
  defaultModel?: string;

  @IsOptional()
  @IsString()
  baseUrl?: string;

  @IsOptional()
  @IsBoolean()
  isEnabled?: boolean;
}

export class UpdateProviderDto {
  @IsOptional()
  @IsInt()
  @Min(0)
  priority?: number;

  @IsOptional()
  @IsString()
  @MinLength(2)
  name?: string;

  @IsOptional()
  @IsString()
  defaultModel?: string;
}

const _adminDtoRuntime = {
  PageQueryDto,
  CreatePromptTemplateDto,
  CreatePromptVersionDto,
  PreviewPromptDto,
  RollbackPromptDto,
  CreateKnowledgeSourceDto,
  IngestDocumentDto,
  UpsertProviderDto,
  UpdateProviderDto,
};
void _adminDtoRuntime;

@ApiTags('admin-ai')
@ApiBearerAuth()
@Roles(...ADMIN_PORTAL_ROLES)
@Controller('api/v1/admin/ai')
export class AdminAiController {
  constructor(
    @Inject(DashboardService) private readonly dashboard: DashboardService,
    @Inject(ModelRouterService) private readonly modelRouter: ModelRouterService,
    @Inject(PromptService) private readonly prompts: PromptService,
    @Inject(KnowledgeService) private readonly knowledge: KnowledgeService,
    @Inject(UsageService) private readonly usage: UsageService,
    @Inject(ConversationService) private readonly conversations: ConversationService,
  ) {}

  @Get('dashboard')
  @Permissions(PERMISSION_AI_ADMIN)
  async dashboardMetrics() {
    return successResponse(await this.dashboard.metrics());
  }

  @Get('audit')
  @Permissions(PERMISSION_AI_ADMIN)
  async audit(@Query() query: PageQueryDto) {
    return successResponse(await this.dashboard.auditTrail(query.skip, query.take));
  }

  @Get('providers')
  @Permissions(PERMISSION_AI_ADMIN)
  async listProviders() {
    return successResponse(await this.modelRouter.status());
  }

  /**
   * Upserts a provider config row. Works without a code change/deploy for a new row of an
   * *existing* `providerType` (e.g. a second OpenAI-compatible endpoint) — `AiProviderRegistry`
   * already knows how to build that backend from env credentials. A brand-new `providerType` value
   * still needs a matching case added to `AiProviderRegistry.buildBackend` and a deploy.
   */
  @Post('providers')
  @Permissions(PERMISSION_AI_ADMIN)
  async upsertProvider(@CurrentUser() user: JwtAccessClaims, @Body() dto: UpsertProviderDto) {
    return successResponse(await this.modelRouter.upsertProvider(dto, user.sub));
  }

  @Patch('providers/:code')
  @Permissions(PERMISSION_AI_ADMIN)
  async updateProvider(
    @Param('code') code: string,
    @CurrentUser() user: JwtAccessClaims,
    @Body() dto: UpdateProviderDto,
  ) {
    return successResponse(await this.modelRouter.updateProvider(code, dto, user.sub));
  }

  @Post('providers/:code/enable')
  @Permissions(PERMISSION_AI_ADMIN)
  async enableProvider(@Param('code') code: string, @CurrentUser() user: JwtAccessClaims) {
    return successResponse(await this.modelRouter.setEnabled(code, true, user.sub));
  }

  @Post('providers/:code/disable')
  @Permissions(PERMISSION_AI_ADMIN)
  async disableProvider(@Param('code') code: string, @CurrentUser() user: JwtAccessClaims) {
    return successResponse(await this.modelRouter.setEnabled(code, false, user.sub));
  }

  @Post('providers/refresh-health')
  @Permissions(PERMISSION_AI_ADMIN)
  async refreshProviderHealth() {
    return successResponse(await this.modelRouter.refreshHealth());
  }

  @Get('model-router/status')
  @Permissions(PERMISSION_AI_ADMIN)
  async modelRouterStatus() {
    return successResponse(await this.modelRouter.status());
  }

  @Get('prompts')
  @Permissions(PERMISSION_AI_PROMPTS)
  async listPrompts(
    @Query('category') category: AiPromptCategory | undefined,
    @Query() query: PageQueryDto,
  ) {
    return successResponse(await this.prompts.list({ category, ...query }));
  }

  @Post('prompts')
  @Permissions(PERMISSION_AI_PROMPTS)
  async createPrompt(@Body() dto: CreatePromptTemplateDto) {
    return successResponse(await this.prompts.create(dto));
  }

  @Get('prompts/:id')
  @Permissions(PERMISSION_AI_PROMPTS)
  async getPrompt(@Param('id') id: string) {
    return successResponse(await this.prompts.get(id));
  }

  @Get('prompts/:id/versions')
  @Permissions(PERMISSION_AI_PROMPTS)
  async listPromptVersions(@Param('id') id: string) {
    return successResponse(await this.prompts.listVersions(id));
  }

  @Post('prompts/:id/versions')
  @Permissions(PERMISSION_AI_PROMPTS)
  async createPromptVersion(
    @Param('id') id: string,
    @CurrentUser() user: JwtAccessClaims,
    @Body() dto: CreatePromptVersionDto,
  ) {
    return successResponse(await this.prompts.createVersion(id, dto, user.sub));
  }

  @Post('prompts/:id/preview')
  @Permissions(PERMISSION_AI_PROMPTS)
  async previewPrompt(@Param('id') id: string, @Body() dto: PreviewPromptDto) {
    return successResponse(await this.prompts.preview(id, dto.variables ?? {}));
  }

  @Post('prompts/:id/submit')
  @Permissions(PERMISSION_AI_PROMPTS)
  async submitPrompt(@Param('id') id: string, @CurrentUser() user: JwtAccessClaims) {
    return successResponse(await this.prompts.submitForApproval(id, user.sub));
  }

  @Post('prompts/:id/approve')
  @Permissions(PERMISSION_AI_PROMPTS)
  async approvePrompt(@Param('id') id: string, @CurrentUser() user: JwtAccessClaims) {
    return successResponse(await this.prompts.approve(id, user.sub));
  }

  @Post('prompts/:id/reject')
  @Permissions(PERMISSION_AI_PROMPTS)
  async rejectPrompt(@Param('id') id: string, @CurrentUser() user: JwtAccessClaims) {
    return successResponse(await this.prompts.reject(id, user.sub));
  }

  @Post('prompts/:id/archive')
  @Permissions(PERMISSION_AI_PROMPTS)
  async archivePrompt(@Param('id') id: string, @CurrentUser() user: JwtAccessClaims) {
    return successResponse(await this.prompts.archive(id, user.sub));
  }

  @Post('prompts/:id/rollback')
  @Permissions(PERMISSION_AI_PROMPTS)
  async rollbackPrompt(
    @Param('id') id: string,
    @CurrentUser() user: JwtAccessClaims,
    @Body() dto: RollbackPromptDto,
  ) {
    return successResponse(await this.prompts.rollback(id, dto.toVersion, user.sub));
  }

  @Get('knowledge/sources')
  @Permissions(PERMISSION_AI_KNOWLEDGE)
  async listKnowledgeSources(@Query() query: PageQueryDto) {
    return successResponse(await this.knowledge.listSources(query));
  }

  @Post('knowledge/sources')
  @Permissions(PERMISSION_AI_KNOWLEDGE)
  async createKnowledgeSource(@Body() dto: CreateKnowledgeSourceDto) {
    return successResponse(await this.knowledge.createSource(dto));
  }

  @Post('knowledge/sources/:id/enable')
  @Permissions(PERMISSION_AI_KNOWLEDGE)
  async enableKnowledgeSource(@Param('id') id: string, @CurrentUser() user: JwtAccessClaims) {
    return successResponse(await this.knowledge.setSourceEnabled(id, true, user.sub));
  }

  @Post('knowledge/sources/:id/disable')
  @Permissions(PERMISSION_AI_KNOWLEDGE)
  async disableKnowledgeSource(@Param('id') id: string, @CurrentUser() user: JwtAccessClaims) {
    return successResponse(await this.knowledge.setSourceEnabled(id, false, user.sub));
  }

  @Get('knowledge/sources/:id/documents')
  @Permissions(PERMISSION_AI_KNOWLEDGE)
  async listDocuments(@Param('id') id: string, @Query() query: PageQueryDto) {
    return successResponse(await this.knowledge.listDocuments(id, query));
  }

  @Post('knowledge/sources/:id/documents')
  @Permissions(PERMISSION_AI_KNOWLEDGE)
  async ingestDocument(
    @Param('id') id: string,
    @CurrentUser() user: JwtAccessClaims,
    @Body() dto: IngestDocumentDto,
  ) {
    return successResponse(await this.knowledge.ingestDocument(id, dto, user.sub));
  }

  @Post('knowledge/documents/:id/reindex')
  @Permissions(PERMISSION_AI_KNOWLEDGE)
  async reindexDocument(@Param('id') id: string, @CurrentUser() user: JwtAccessClaims) {
    return successResponse(await this.knowledge.reindexDocument(id, {}, user.sub));
  }

  @Post('knowledge/sources/:id/refresh')
  @Permissions(PERMISSION_AI_KNOWLEDGE)
  async refreshKnowledgeSource(@Param('id') id: string) {
    return successResponse(await this.knowledge.refreshSource(id));
  }

  @Get('usage')
  @Permissions(PERMISSION_AI_ADMIN)
  async usageSummary(@Query('providerCode') providerCode: string | undefined) {
    return successResponse(await this.usage.summary({ providerCode }));
  }

  @Get('usage/by-provider')
  @Permissions(PERMISSION_AI_ADMIN)
  async usageByProvider() {
    return successResponse(await this.usage.byProvider());
  }

  @Get('conversations')
  @Permissions(PERMISSION_AI_ADMIN)
  async listConversations(
    @Query('ownerUserId') ownerUserId: string | undefined,
    @Query('assistantType') assistantType: AiAssistantType | undefined,
    @Query() query: PageQueryDto,
  ) {
    return successResponse(
      await this.conversations.listAdmin({ ownerUserId, assistantType, ...query }),
    );
  }
}
