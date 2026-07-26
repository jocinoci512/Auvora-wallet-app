import { ForbiddenError, ProviderUnavailableError, SafetyViolationError } from '../../domain';
import { ChatService } from './chat.service';

function buildPrismaMock() {
  return {
    aiProvider: { findUnique: jest.fn().mockResolvedValue({ id: 'provider-1', code: 'sim-default' }) },
    aiRequest: { create: jest.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) => Promise.resolve({ id: 'req-1', createdAt: new Date(), ...data })) },
    aiTokenUsage: { create: jest.fn().mockResolvedValue({}) },
    aiProviderMetric: { upsert: jest.fn().mockResolvedValue({}) },
  };
}

const conversation = {
  id: 'conv-1',
  ownerUserId: 'user-1',
  assistantType: 'CUSTOMER_SUPPORT',
  status: 'ACTIVE',
};

function buildConversationsMock() {
  return {
    get: jest.fn().mockResolvedValue(conversation),
    create: jest.fn().mockResolvedValue(conversation),
    assertOwner: jest.fn().mockImplementation((conv: { ownerUserId: string }, requesterId: string) => {
      if (conv.ownerUserId !== requesterId) throw new ForbiddenError('Access denied');
    }),
    getRecentMessages: jest.fn().mockResolvedValue([]),
    appendMessage: jest.fn().mockImplementation((_id: string, input: Record<string, unknown>) =>
      Promise.resolve({ id: `msg-${Math.random()}`, createdAt: new Date(), ...input }),
    ),
  };
}

const promptsMock = { getActiveVersionByCode: jest.fn().mockRejectedValue(new Error('not found')) };

function buildModelRouterMock(chatImpl: (provider: { chat: (r: unknown) => Promise<unknown> }) => Promise<unknown>) {
  return {
    withFailover: jest.fn().mockImplementation(async (fn: (p: unknown) => Promise<unknown>) => {
      const result = await fn({ chat: chatImpl } as never);
      return { result, providerCode: 'sim-default' };
    }),
  };
}

function buildCacheMock(initial: string | null = null) {
  const store = new Map<string, string>();
  if (initial) store.set('preset', initial);
  return {
    buildKey: jest.fn().mockReturnValue('cache-key-1'),
    get: jest.fn().mockImplementation((key: string) => Promise.resolve(store.get(key) ?? null)),
    set: jest.fn().mockImplementation((key: string, value: string) => {
      store.set(key, value);
      return Promise.resolve();
    }),
    __store: store,
  };
}

function buildAuditMock() {
  return { record: jest.fn().mockResolvedValue({}) };
}

const vectorSearchMock = { search: jest.fn().mockResolvedValue([]) };
const eventsMock = { publish: jest.fn().mockResolvedValue(undefined) };
const analyticsMock = { publishEvent: jest.fn().mockResolvedValue(undefined) };
const env = { AI_CACHE_TTL_SECONDS: 60 } as never;

describe('ChatService', () => {
  beforeEach(() => jest.clearAllMocks());

  it('runs the full chat pipeline and persists messages, request, and usage', async () => {
    const prisma = buildPrismaMock();
    const conversations = buildConversationsMock();
    const cache = buildCacheMock();
    const audit = buildAuditMock();
    const modelRouter = buildModelRouterMock(async () =>
      ({ providerCode: 'sim-default', model: 'sim-gpt', content: '[simulator] hi there', inputTokens: 5, outputTokens: 5, latencyMs: 10 }),
    );

    const service = new ChatService(
      prisma as never,
      eventsMock as never,
      env,
      conversations as never,
      promptsMock as never,
      modelRouter as never,
      cache as never,
      vectorSearchMock as never,
      audit as never,
      analyticsMock as never,
    );

    const result = await service.chat({ ownerUserId: 'user-1', message: 'hello there' });

    expect(result.cached).toBe(false);
    expect(result.assistantMessage).toMatchObject({ role: 'ASSISTANT' });
    expect(prisma.aiRequest.create).toHaveBeenCalled();
    expect(prisma.aiTokenUsage.create).toHaveBeenCalled();
    expect(prisma.aiProviderMetric.upsert).toHaveBeenCalled();
    expect(audit.record).toHaveBeenCalledWith('ai.chat.completed', expect.objectContaining({ actorUserId: 'user-1' }));
    expect(eventsMock.publish).toHaveBeenCalledWith(expect.objectContaining({ type: 'RequestCompleted' }));
  });

  it('rejects a message that fails safety validation', async () => {
    const prisma = buildPrismaMock();
    const conversations = buildConversationsMock();
    const cache = buildCacheMock();
    const audit = buildAuditMock();
    const modelRouter = buildModelRouterMock(async () => ({ content: 'unused', model: 'sim-gpt', inputTokens: 1, outputTokens: 1, latencyMs: 1, providerCode: 'sim-default' }));

    const service = new ChatService(
      prisma as never,
      eventsMock as never,
      env,
      conversations as never,
      promptsMock as never,
      modelRouter as never,
      cache as never,
      vectorSearchMock as never,
      audit as never,
      analyticsMock as never,
    );

    await expect(service.chat({ ownerUserId: 'user-1', message: '' })).rejects.toThrow(SafetyViolationError);
    expect(modelRouter.withFailover).not.toHaveBeenCalled();
  });

  it('rejects chatting into a conversation owned by someone else', async () => {
    const prisma = buildPrismaMock();
    const conversations = buildConversationsMock();
    conversations.get.mockResolvedValueOnce({ ...conversation, ownerUserId: 'someone-else' });
    const cache = buildCacheMock();
    const audit = buildAuditMock();
    const modelRouter = buildModelRouterMock(async () => ({ content: 'x', model: 'sim-gpt', inputTokens: 1, outputTokens: 1, latencyMs: 1, providerCode: 'sim-default' }));

    const service = new ChatService(
      prisma as never,
      eventsMock as never,
      env,
      conversations as never,
      promptsMock as never,
      modelRouter as never,
      cache as never,
      vectorSearchMock as never,
      audit as never,
      analyticsMock as never,
    );

    await expect(
      service.chat({ ownerUserId: 'user-1', conversationId: 'conv-1', message: 'hi' }),
    ).rejects.toThrow(ForbiddenError);
  });

  it('serves a cached response without calling the model router', async () => {
    const prisma = buildPrismaMock();
    const conversations = buildConversationsMock();
    const cache = buildCacheMock();
    const audit = buildAuditMock();
    cache.get.mockResolvedValueOnce(
      JSON.stringify({ content: 'cached reply', providerCode: 'sim-default', model: 'sim-gpt', inputTokens: 2, outputTokens: 2 }),
    );
    const modelRouter = buildModelRouterMock(async () => {
      throw new Error('should not be called');
    });

    const service = new ChatService(
      prisma as never,
      eventsMock as never,
      env,
      conversations as never,
      promptsMock as never,
      modelRouter as never,
      cache as never,
      vectorSearchMock as never,
      audit as never,
      analyticsMock as never,
    );

    const result = await service.chat({ ownerUserId: 'user-1', message: 'hello again' });
    expect(result.cached).toBe(true);
    expect(modelRouter.withFailover).not.toHaveBeenCalled();
  });

  it('records a failed AiRequest and rethrows when every provider fails', async () => {
    const prisma = buildPrismaMock();
    const conversations = buildConversationsMock();
    const cache = buildCacheMock();
    const audit = buildAuditMock();
    const modelRouter = {
      withFailover: jest.fn().mockRejectedValue(new ProviderUnavailableError('all providers down')),
    };

    const service = new ChatService(
      prisma as never,
      eventsMock as never,
      env,
      conversations as never,
      promptsMock as never,
      modelRouter as never,
      cache as never,
      vectorSearchMock as never,
      audit as never,
      analyticsMock as never,
    );

    await expect(service.chat({ ownerUserId: 'user-1', message: 'hello' })).rejects.toThrow(ProviderUnavailableError);
    expect(prisma.aiRequest.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'FAILED' }) }),
    );
    expect(audit.record).toHaveBeenCalledWith('ai.chat.failed', expect.objectContaining({ actorUserId: 'user-1' }));
    expect(eventsMock.publish).toHaveBeenCalledWith(expect.objectContaining({ type: 'RequestFailed' }));
  });

  it('includes knowledge base citations in the system prompt when useKnowledge is set', async () => {
    const prisma = buildPrismaMock();
    const conversations = buildConversationsMock();
    const cache = buildCacheMock();
    const audit = buildAuditMock();
    vectorSearchMock.search.mockResolvedValueOnce([
      { chunkId: 'c1', documentId: 'd1', documentVersion: 1, sourceId: 's1', sourceCode: 'docs', sourceName: 'Docs', documentTitle: 'T', content: 'wallets can hold BTC and ETH', score: 0.9 },
    ]);
    let capturedMessages: Array<{ role: string; content: string }> = [];
    const modelRouter = buildModelRouterMock(async (provider) => {
      const chatFn = provider.chat as unknown as (r: { messages: Array<{ role: string; content: string }> }) => Promise<unknown>;
      return chatFn({ messages: [] }).then(() => ({ content: 'ok', model: 'sim-gpt', inputTokens: 1, outputTokens: 1, latencyMs: 1, providerCode: 'sim-default' }));
    });
    // Override to capture messages passed into provider.chat
    modelRouter.withFailover = jest.fn().mockImplementation(async (fn: (p: { chat: (r: { messages: Array<{ role: string; content: string }> }) => Promise<unknown> }) => Promise<unknown>) => {
      const provider = {
        chat: (r: { messages: Array<{ role: string; content: string }> }) => {
          capturedMessages = r.messages;
          return Promise.resolve({ content: 'ok', model: 'sim-gpt', inputTokens: 1, outputTokens: 1, latencyMs: 1, providerCode: 'sim-default' });
        },
      };
      const result = await fn(provider);
      return { result, providerCode: 'sim-default' };
    });

    const service = new ChatService(
      prisma as never,
      eventsMock as never,
      env,
      conversations as never,
      promptsMock as never,
      modelRouter as never,
      cache as never,
      vectorSearchMock as never,
      audit as never,
      analyticsMock as never,
    );

    const result = await service.chat({ ownerUserId: 'user-1', message: 'what assets can I hold?', useKnowledge: true });
    expect(result.citations).toHaveLength(1);
    expect(capturedMessages[0].content).toContain('wallets can hold BTC and ETH');
  });

  it('persists citations on the assistant message metadata and the AiRequest metadata', async () => {
    const prisma = buildPrismaMock();
    const conversations = buildConversationsMock();
    const cache = buildCacheMock();
    const audit = buildAuditMock();
    const citation = { chunkId: 'c1', documentId: 'd1', documentVersion: 2, sourceId: 's1', sourceCode: 'docs', sourceName: 'Docs', documentTitle: 'T', content: 'snippet', score: 0.8 };
    vectorSearchMock.search.mockResolvedValueOnce([citation]);
    const modelRouter = buildModelRouterMock(async () => ({ content: 'ok', model: 'sim-gpt', inputTokens: 1, outputTokens: 1, latencyMs: 1, providerCode: 'sim-default' }));

    const service = new ChatService(
      prisma as never,
      eventsMock as never,
      env,
      conversations as never,
      promptsMock as never,
      modelRouter as never,
      cache as never,
      vectorSearchMock as never,
      audit as never,
      analyticsMock as never,
    );

    const result = await service.chat({ ownerUserId: 'user-1', message: 'cite this please', useKnowledge: true });

    expect(result.assistantMessage).toMatchObject({ metadata: { citations: [citation] } });
    expect(prisma.aiRequest.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ metadata: { citations: [citation] } }) }),
    );
  });

  it('always sets a correlationId on the AiRequest, generating one when the caller omits it', async () => {
    const prisma = buildPrismaMock();
    const conversations = buildConversationsMock();
    const cache = buildCacheMock();
    const audit = buildAuditMock();
    const modelRouter = buildModelRouterMock(async () => ({ content: 'ok', model: 'sim-gpt', inputTokens: 1, outputTokens: 1, latencyMs: 1, providerCode: 'sim-default' }));

    const service = new ChatService(
      prisma as never,
      eventsMock as never,
      env,
      conversations as never,
      promptsMock as never,
      modelRouter as never,
      cache as never,
      vectorSearchMock as never,
      audit as never,
      analyticsMock as never,
    );

    await service.chat({ ownerUserId: 'user-1', message: 'no correlation id supplied' });

    const createCall = (prisma.aiRequest.create as jest.Mock).mock.calls[0][0] as { data: { correlationId?: string } };
    expect(createCall.data.correlationId).toEqual(expect.any(String));
    expect(createCall.data.correlationId!.length).toBeGreaterThan(0);
    expect(audit.record).toHaveBeenCalledWith(
      'ai.chat.completed',
      expect.objectContaining({ correlationId: createCall.data.correlationId }),
    );
    expect(eventsMock.publish).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'RequestCompleted', correlationId: createCall.data.correlationId }),
    );
  });

  it('propagates a caller-supplied correlationId end-to-end instead of generating a new one', async () => {
    const prisma = buildPrismaMock();
    const conversations = buildConversationsMock();
    const cache = buildCacheMock();
    const audit = buildAuditMock();
    const modelRouter = buildModelRouterMock(async () => ({ content: 'ok', model: 'sim-gpt', inputTokens: 1, outputTokens: 1, latencyMs: 1, providerCode: 'sim-default' }));

    const service = new ChatService(
      prisma as never,
      eventsMock as never,
      env,
      conversations as never,
      promptsMock as never,
      modelRouter as never,
      cache as never,
      vectorSearchMock as never,
      audit as never,
      analyticsMock as never,
    );

    await service.chat({ ownerUserId: 'user-1', message: 'has a correlation id', correlationId: 'corr-123' });

    expect(prisma.aiRequest.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ correlationId: 'corr-123' }) }),
    );
    expect(audit.record).toHaveBeenCalledWith('ai.chat.completed', expect.objectContaining({ correlationId: 'corr-123' }));
  });
});
