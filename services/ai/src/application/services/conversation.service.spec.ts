import { ForbiddenError, NotFoundError } from '../../domain';
import { ConversationService } from './conversation.service';

function buildPrismaMock(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    aiConversation: {
      create: jest.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) =>
        Promise.resolve({ id: 'conv-1', createdAt: new Date(), updatedAt: new Date(), status: 'ACTIVE', ...data }),
      ),
      findUnique: jest.fn().mockResolvedValue({ id: 'conv-1', ownerUserId: 'user-1', status: 'ACTIVE' }),
      update: jest.fn().mockImplementation(({ where, data }: { where: { id: string }; data: Record<string, unknown> }) =>
        Promise.resolve({ id: where.id, ownerUserId: 'user-1', status: 'ACTIVE', ...data }),
      ),
      updateMany: jest.fn().mockResolvedValue({ count: 2 }),
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
    },
    aiMessage: {
      create: jest.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) =>
        Promise.resolve({ id: 'msg-1', createdAt: new Date(), ...data }),
      ),
      findMany: jest.fn().mockResolvedValue([]),
      findUnique: jest.fn().mockResolvedValue({ id: 'msg-1', conversationId: 'conv-1' }),
      update: jest.fn().mockImplementation(({ where, data }: { where: { id: string }; data: Record<string, unknown> }) =>
        Promise.resolve({ id: where.id, ...data }),
      ),
    },
    ...overrides,
  };
}

const eventsMock = { publish: jest.fn().mockResolvedValue(undefined) };

describe('ConversationService', () => {
  beforeEach(() => jest.clearAllMocks());

  it('creates a conversation and publishes ConversationCreated', async () => {
    const prisma = buildPrismaMock();
    const service = new ConversationService(prisma as never, eventsMock as never);

    const conversation = await service.create({ ownerUserId: 'user-1', assistantType: 'WALLET' as never });
    expect(conversation).toMatchObject({ ownerUserId: 'user-1', assistantType: 'WALLET' });
    expect(eventsMock.publish).toHaveBeenCalledWith(expect.objectContaining({ type: 'ConversationCreated' }));
  });

  it('appends a message and bumps lastMessageAt', async () => {
    const prisma = buildPrismaMock();
    const service = new ConversationService(prisma as never, eventsMock as never);

    const message = await service.appendMessage('conv-1', { role: 'USER' as never, content: 'hi' });
    expect(message).toMatchObject({ role: 'USER', content: 'hi' });
    expect(prisma.aiConversation.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'conv-1' } }),
    );
  });

  it('enforces owner-or-admin access on conversations', () => {
    const prisma = buildPrismaMock();
    const service = new ConversationService(prisma as never, eventsMock as never);
    const conversation = { ownerUserId: 'user-1' };

    expect(() => service.assertOwner(conversation, 'user-1', false)).not.toThrow();
    expect(() => service.assertOwner(conversation, 'user-2', true)).not.toThrow();
    expect(() => service.assertOwner(conversation, 'user-2', false)).toThrow(ForbiddenError);
  });

  it('records feedback on a message when the actor owns the conversation', async () => {
    const prisma = buildPrismaMock();
    const service = new ConversationService(prisma as never, eventsMock as never);
    const actor = { sub: 'user-1', permissions: [] as string[] };
    const updated = await service.recordFeedback('msg-1', 1, actor as never, 'great answer');
    expect(updated).toMatchObject({ feedbackScore: 1, feedbackNotes: 'great answer' });
  });

  it('throws NotFoundError when recording feedback on a missing message', async () => {
    const prisma = buildPrismaMock({ aiMessage: { findUnique: jest.fn().mockResolvedValue(null) } });
    const service = new ConversationService(prisma as never, eventsMock as never);
    const actor = { sub: 'user-1', permissions: [] as string[] };
    await expect(service.recordFeedback('missing', 1, actor as never)).rejects.toThrow(NotFoundError);
  });

  it('rejects feedback from a user who does not own the conversation and lacks ai:admin', async () => {
    const prisma = buildPrismaMock();
    const service = new ConversationService(prisma as never, eventsMock as never);
    const actor = { sub: 'someone-else', permissions: [] as string[] };
    await expect(service.recordFeedback('msg-1', 1, actor as never)).rejects.toThrow(ForbiddenError);
  });

  it('allows feedback from an admin holding ai:admin even without ownership', async () => {
    const prisma = buildPrismaMock();
    const service = new ConversationService(prisma as never, eventsMock as never);
    const actor = { sub: 'someone-else', permissions: ['ai:admin'] as string[] };
    const updated = await service.recordFeedback('msg-1', -1, actor as never, 'admin override');
    expect(updated).toMatchObject({ feedbackScore: -1, feedbackNotes: 'admin override' });
  });

  it('exports a conversation transcript', async () => {
    const prisma = buildPrismaMock();
    const service = new ConversationService(prisma as never, eventsMock as never);
    const exported = await service.exportConversation('conv-1');
    expect(exported).toHaveProperty('conversation');
    expect(exported).toHaveProperty('messages');
    expect(exported).toHaveProperty('exportedAt');
  });

  it('expires stale conversations past their retention window', async () => {
    const prisma = buildPrismaMock();
    const service = new ConversationService(prisma as never, eventsMock as never);
    const result = await service.expireStale();
    expect(result).toEqual({ expired: 2 });
  });
});
