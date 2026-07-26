import { Body, Controller, Get, Inject, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { AiAssistantType } from '@auvora/database';
import type { JwtAccessClaims } from '@auvora/types';
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
  MinLength,
} from 'class-validator';
import { ChatService } from '../../application/services/chat.service';
import { ConversationService } from '../../application/services/conversation.service';
import { KnowledgeService } from '../../application/services/knowledge.service';
import { ALL_ASSISTANT_TYPES, listAssistants } from '../../application/assistant-registry';
import { PERMISSION_AI_CHAT, PERMISSION_AI_KNOWLEDGE, PERMISSION_AI_READ } from '../../domain';
import { successResponse } from '../common/api-response';
import { Permissions } from '../decorators/auth.decorators';
import { CorrelationId, CurrentUser } from '../decorators/current-user.decorator';

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

export class ChatDto {
  @IsOptional()
  @IsUUID()
  conversationId?: string;

  @IsOptional()
  @IsIn(ALL_ASSISTANT_TYPES)
  assistantType?: AiAssistantType;

  @IsString()
  @MinLength(1)
  message!: string;

  @IsOptional()
  @IsString()
  providerCode?: string;

  @IsOptional()
  @IsBoolean()
  useKnowledge?: boolean;

  @IsOptional()
  @IsArray()
  knowledgeSourceIds?: string[];

  @IsOptional()
  @IsString()
  correlationId?: string;
}

export class CreateConversationDto {
  @IsOptional()
  @IsIn(ALL_ASSISTANT_TYPES)
  assistantType?: AiAssistantType;

  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  locale?: string;
}

export class FeedbackDto {
  @IsNumber()
  @Min(-1)
  @Max(1)
  score!: number;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class KnowledgeSearchDto {
  @IsString()
  @MinLength(1)
  query!: string;

  @IsOptional()
  @IsArray()
  sourceIds?: string[];

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(20)
  topK?: number;
}

const _dtoRuntime = { PageQueryDto, ChatDto, CreateConversationDto, FeedbackDto, KnowledgeSearchDto };
void _dtoRuntime;

@ApiTags('ai')
@ApiBearerAuth()
@Controller('api/v1/ai')
export class AiController {
  constructor(
    @Inject(ChatService) private readonly chat: ChatService,
    @Inject(ConversationService) private readonly conversations: ConversationService,
    @Inject(KnowledgeService) private readonly knowledge: KnowledgeService,
  ) {}

  @Post('chat')
  @Permissions(PERMISSION_AI_CHAT)
  async sendChat(
    @CurrentUser() user: JwtAccessClaims,
    @Body() dto: ChatDto,
    @CorrelationId() correlationId?: string,
  ) {
    return successResponse(
      await this.chat.chat({ ownerUserId: user.sub, ...dto, correlationId: dto.correlationId ?? correlationId }),
    );
  }

  @Get('conversations')
  @Permissions(PERMISSION_AI_READ)
  async listConversations(@CurrentUser() user: JwtAccessClaims, @Query() query: PageQueryDto) {
    return successResponse(await this.conversations.list(user.sub, query));
  }

  @Post('conversations')
  @Permissions(PERMISSION_AI_CHAT)
  async createConversation(@CurrentUser() user: JwtAccessClaims, @Body() dto: CreateConversationDto) {
    return successResponse(await this.conversations.create({ ownerUserId: user.sub, ...dto }));
  }

  @Get('conversations/:id')
  @Permissions(PERMISSION_AI_READ)
  async getConversation(@Param('id') id: string, @CurrentUser() user: JwtAccessClaims) {
    const { conversation, messages } = await this.conversations.getWithMessages(id);
    this.conversations.assertOwner(conversation, user.sub, false);
    return successResponse({ conversation, messages });
  }

  @Post('conversations/:id/messages')
  @Permissions(PERMISSION_AI_CHAT)
  async continueConversation(
    @Param('id') id: string,
    @CurrentUser() user: JwtAccessClaims,
    @Body() dto: ChatDto,
    @CorrelationId() correlationId?: string,
  ) {
    return successResponse(
      await this.chat.chat({
        ownerUserId: user.sub,
        ...dto,
        conversationId: id,
        correlationId: dto.correlationId ?? correlationId,
      }),
    );
  }

  @Get('conversations/:id/export')
  @Permissions(PERMISSION_AI_READ)
  async exportConversation(@Param('id') id: string, @CurrentUser() user: JwtAccessClaims) {
    const conversation = await this.conversations.get(id);
    this.conversations.assertOwner(conversation, user.sub, false);
    return successResponse(await this.conversations.exportConversation(id));
  }

  @Post('messages/:id/feedback')
  @Permissions(PERMISSION_AI_CHAT)
  async recordFeedback(@Param('id') id: string, @CurrentUser() user: JwtAccessClaims, @Body() dto: FeedbackDto) {
    return successResponse(await this.conversations.recordFeedback(id, dto.score, user, dto.notes));
  }

  @Post('knowledge/search')
  @Permissions(PERMISSION_AI_KNOWLEDGE)
  async searchKnowledge(@Body() dto: KnowledgeSearchDto) {
    return successResponse(await this.knowledge.search(dto.query, { sourceIds: dto.sourceIds, topK: dto.topK }));
  }

  @Get('assistants')
  @Permissions(PERMISSION_AI_READ)
  listAssistantTypes() {
    return successResponse(listAssistants());
  }
}
