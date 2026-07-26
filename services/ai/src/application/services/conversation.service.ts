import { Inject, Injectable } from '@nestjs/common';
import { PrismaService, type AiAssistantType, type AiMessageRole, type Prisma } from '@auvora/database';
import type { JwtAccessClaims } from '@auvora/types';
import { EVENT_BUS, AiEventType, ForbiddenError, NotFoundError, PERMISSION_AI_ADMIN, type EventBusPort } from '../../domain';

export interface CreateConversationInput {
  ownerUserId: string;
  assistantType?: AiAssistantType;
  title?: string;
  locale?: string;
  expiresAt?: Date;
  metadata?: Record<string, unknown>;
}

export interface AppendMessageInput {
  role: AiMessageRole;
  content: string;
  tokenCount?: number;
  model?: string;
  providerCode?: string;
  metadata?: Record<string, unknown>;
}

@Injectable()
export class ConversationService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(EVENT_BUS) private readonly events: EventBusPort,
  ) {}

  async create(input: CreateConversationInput) {
    const conversation = await this.prisma.aiConversation.create({
      data: {
        ownerUserId: input.ownerUserId,
        assistantType: input.assistantType ?? 'CUSTOMER_SUPPORT',
        title: input.title,
        locale: input.locale ?? 'en',
        expiresAt: input.expiresAt,
        metadata: (input.metadata ?? {}) as Prisma.InputJsonValue,
      },
    });

    await this.events.publish({
      type: AiEventType.ConversationCreated,
      aggregateId: conversation.id,
      payload: { ownerUserId: input.ownerUserId, assistantType: conversation.assistantType },
    });

    return conversation;
  }

  async list(ownerUserId: string, filters: { status?: string; skip?: number; take?: number } = {}) {
    const skip = filters.skip ?? 0;
    const take = Math.min(filters.take ?? 50, 200);
    const where: Prisma.AiConversationWhereInput = {
      ownerUserId,
      ...(filters.status ? { status: filters.status as never } : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.aiConversation.findMany({ where, orderBy: { updatedAt: 'desc' }, skip, take }),
      this.prisma.aiConversation.count({ where }),
    ]);
    return { items, total, skip, take };
  }

  async listAdmin(filters: { ownerUserId?: string; assistantType?: AiAssistantType; skip?: number; take?: number } = {}) {
    const skip = filters.skip ?? 0;
    const take = Math.min(filters.take ?? 50, 200);
    const where: Prisma.AiConversationWhereInput = {
      ...(filters.ownerUserId ? { ownerUserId: filters.ownerUserId } : {}),
      ...(filters.assistantType ? { assistantType: filters.assistantType } : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.aiConversation.findMany({ where, orderBy: { updatedAt: 'desc' }, skip, take }),
      this.prisma.aiConversation.count({ where }),
    ]);
    return { items, total, skip, take };
  }

  async searchByTitle(ownerUserId: string, query: string, take = 20) {
    return this.prisma.aiConversation.findMany({
      where: { ownerUserId, title: { contains: query, mode: 'insensitive' } },
      orderBy: { updatedAt: 'desc' },
      take: Math.min(take, 100),
    });
  }

  async get(id: string) {
    const conversation = await this.prisma.aiConversation.findUnique({ where: { id } });
    if (!conversation) throw new NotFoundError('Conversation not found');
    return conversation;
  }

  async getWithMessages(id: string) {
    const conversation = await this.get(id);
    const messages = await this.prisma.aiMessage.findMany({
      where: { conversationId: id },
      orderBy: { createdAt: 'asc' },
    });
    return { conversation, messages };
  }

  async getRecentMessages(conversationId: string, limit = 20) {
    const messages = await this.prisma.aiMessage.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
    return messages.reverse();
  }

  assertOwner(conversation: { ownerUserId: string }, requesterId: string, isAdmin: boolean): void {
    if (conversation.ownerUserId !== requesterId && !isAdmin) {
      throw new ForbiddenError('Access denied');
    }
  }

  async appendMessage(conversationId: string, input: AppendMessageInput) {
    await this.get(conversationId);
    const message = await this.prisma.aiMessage.create({
      data: {
        conversationId,
        role: input.role,
        content: input.content,
        tokenCount: input.tokenCount,
        model: input.model,
        providerCode: input.providerCode,
        metadata: (input.metadata ?? {}) as Prisma.InputJsonValue,
      },
    });
    await this.prisma.aiConversation.update({
      where: { id: conversationId },
      data: { lastMessageAt: message.createdAt },
    });
    await this.events.publish({
      type: AiEventType.MessageAppended,
      aggregateId: conversationId,
      payload: { role: input.role, messageId: message.id },
    });
    return message;
  }

  /** Only the conversation's owner, or a caller holding `ai:admin`, may record feedback on its messages. */
  async recordFeedback(
    messageId: string,
    score: number,
    actor: Pick<JwtAccessClaims, 'sub' | 'permissions'>,
    notes?: string,
  ) {
    const message = await this.prisma.aiMessage.findUnique({ where: { id: messageId } });
    if (!message) throw new NotFoundError('Message not found');
    const conversation = await this.get(message.conversationId);
    this.assertOwner(conversation, actor.sub, actor.permissions.includes(PERMISSION_AI_ADMIN));

    const updated = await this.prisma.aiMessage.update({
      where: { id: messageId },
      data: { feedbackScore: score, feedbackNotes: notes },
    });
    await this.events.publish({
      type: AiEventType.MessageFeedbackRecorded,
      aggregateId: message.conversationId,
      payload: { messageId, score },
    });
    return updated;
  }

  async archive(id: string) {
    await this.get(id);
    const updated = await this.prisma.aiConversation.update({ where: { id }, data: { status: 'ARCHIVED' } });
    await this.events.publish({ type: AiEventType.ConversationArchived, aggregateId: id, payload: {} });
    return updated;
  }

  async exportConversation(id: string) {
    const { conversation, messages } = await this.getWithMessages(id);
    return {
      conversation,
      messages,
      exportedAt: new Date().toISOString(),
    };
  }

  /** Retention job: marks conversations whose `expiresAt` has passed as EXPIRED. Returns the count updated. */
  async expireStale(at: Date = new Date()) {
    const result = await this.prisma.aiConversation.updateMany({
      where: { status: 'ACTIVE', expiresAt: { not: null, lte: at } },
      data: { status: 'EXPIRED' },
    });
    return { expired: result.count };
  }
}
