import { Body, Controller, Inject, Post, UseGuards } from '@nestjs/common';
import { ApiExcludeController, ApiTags } from '@nestjs/swagger';
import type { AiAssistantType } from '@auvora/database';
import { IsIn, IsObject, IsOptional, IsString, IsUUID, MinLength } from 'class-validator';
import { ALL_ASSISTANT_TYPES } from '../../application/assistant-registry';
import { AutomationService } from '../../application/services/automation.service';
import { ChatService } from '../../application/services/chat.service';
import { AiEventType, EVENT_BUS, type EventBusPort } from '../../domain';
import { successResponse } from '../common/api-response';
import { Public, SkipCsrf } from '../decorators/auth.decorators';
import { CorrelationId } from '../decorators/current-user.decorator';
import { InternalApiKeyGuard } from '../guards/internal-api-key.guard';

export class InternalCompleteDto {
  @IsUUID()
  ownerUserId!: string;

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
  @IsString()
  correlationId?: string;
}

export class InternalEventIngestDto {
  @IsString()
  @MinLength(1)
  eventType!: string;

  @IsOptional()
  @IsUUID()
  aggregateId?: string;

  @IsObject()
  payload!: Record<string, unknown>;

  @IsOptional()
  @IsString()
  correlationId?: string;
}

export class InternalSummarizeDto {
  @IsUUID()
  ownerUserId!: string;

  @IsString()
  @MinLength(1)
  text!: string;

  @IsOptional()
  @IsString()
  correlationId?: string;
}

const _internalDtoRuntime = { InternalCompleteDto, InternalEventIngestDto, InternalSummarizeDto };
void _internalDtoRuntime;

@ApiTags('internal-ai')
@ApiExcludeController()
@Public()
@SkipCsrf()
@UseGuards(InternalApiKeyGuard)
@Controller('api/v1/internal/ai')
export class InternalAiController {
  constructor(
    @Inject(ChatService) private readonly chat: ChatService,
    @Inject(AutomationService) private readonly automation: AutomationService,
    @Inject(EVENT_BUS) private readonly events: EventBusPort,
  ) {}

  @Post('complete')
  async complete(@Body() dto: InternalCompleteDto, @CorrelationId() correlationId?: string) {
    return successResponse(await this.chat.chat({ ...dto, correlationId: dto.correlationId ?? correlationId }));
  }

  /** Fan-in ingestion point for upstream services to trigger AI-driven automation from domain events. */
  @Post('events')
  async ingestEvent(@Body() dto: InternalEventIngestDto) {
    await this.events.publish({
      type: AiEventType.RequestCompleted,
      aggregateId: dto.aggregateId,
      correlationId: dto.correlationId,
      payload: { sourceEventType: dto.eventType, ...dto.payload },
    });
    return successResponse({ received: true, eventType: dto.eventType });
  }

  @Post('summarize')
  async summarize(@Body() dto: InternalSummarizeDto, @CorrelationId() correlationId?: string) {
    return successResponse(
      await this.automation.summarizeCase(dto.ownerUserId, dto.text, dto.correlationId ?? correlationId),
    );
  }
}
