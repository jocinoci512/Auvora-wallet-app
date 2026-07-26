import { NotFoundError } from '../../domain';
import { KnowledgeService } from './knowledge.service';

function buildPrismaMock() {
  const documents = new Map<string, Record<string, unknown>>();
  const chunks: Array<Record<string, unknown>> = [];

  return {
    aiKnowledgeSource: {
      findUnique: jest.fn().mockResolvedValue({ id: 'src-1', code: 'docs', version: 1 }),
      create: jest.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) =>
        Promise.resolve({ id: 'src-1', createdAt: new Date(), ...data }),
      ),
      update: jest.fn().mockImplementation(({ where, data }: { where: { id: string }; data: Record<string, unknown> }) =>
        Promise.resolve({ id: where.id, version: 1, ...data }),
      ),
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
    },
    aiDocument: {
      create: jest.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) => {
        const id = `doc-${documents.size + 1}`;
        const record = { id, createdAt: new Date(), updatedAt: new Date(), version: 1, ...data };
        documents.set(id, record);
        return Promise.resolve(record);
      }),
      findUnique: jest.fn().mockImplementation(({ where }: { where: { id: string } }) =>
        Promise.resolve(documents.get(where.id) ?? null),
      ),
      findFirst: jest.fn().mockImplementation(({ where }: { where: { sourceId: string; title: string } }) =>
        Promise.resolve([...documents.values()].find((d) => d['sourceId'] === where.sourceId && d['title'] === where.title) ?? null),
      ),
      update: jest.fn().mockImplementation(({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
        const existing = documents.get(where.id) ?? {};
        const updated = { ...existing, ...data };
        documents.set(where.id, updated);
        return Promise.resolve(updated);
      }),
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(1),
    },
    aiDocumentChunk: {
      create: jest.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) => {
        const record = { id: `chunk-${chunks.length + 1}`, createdAt: new Date(), ...data };
        chunks.push(record);
        return Promise.resolve(record);
      }),
      deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
      count: jest.fn().mockResolvedValue(chunks.length),
    },
    aiEmbedding: {
      create: jest.fn().mockResolvedValue({}),
    },
    aiVectorIndexMeta: {
      upsert: jest.fn().mockResolvedValue({}),
    },
    __documents: documents,
    __chunks: chunks,
  };
}

const embeddingsMock = {
  embed: jest.fn().mockImplementation((texts: string[]) =>
    Promise.resolve({
      providerCode: 'sim-default',
      model: 'sim-embed-v1',
      dimensions: 4,
      vectors: texts.map(() => [0.1, 0.2, 0.3, 0.4]),
      latencyMs: 1,
    }),
  ),
};

const vectorSearchMock = { search: jest.fn().mockResolvedValue([]) };
const eventsMock = { publish: jest.fn().mockResolvedValue(undefined) };

function buildAuditMock() {
  return { record: jest.fn().mockResolvedValue({}) };
}

describe('KnowledgeService', () => {
  beforeEach(() => jest.clearAllMocks());

  it('ingests a document: chunks, embeds, and marks it INDEXED', async () => {
    const prisma = buildPrismaMock();
    const service = new KnowledgeService(prisma as never, eventsMock as never, embeddingsMock as never, vectorSearchMock as never, buildAuditMock() as never);

    const content = 'Auvora Wallet lets users hold and transfer digital assets. '.repeat(20);
    const document = await service.ingestDocument('src-1', { title: 'Overview', content, chunkSize: 100, chunkOverlap: 10 });

    expect(document.status).toBe('INDEXED');
    expect(prisma.aiDocumentChunk.create).toHaveBeenCalled();
    expect(prisma.aiEmbedding.create).toHaveBeenCalled();
    expect(embeddingsMock.embed).toHaveBeenCalled();
  });

  it('marks a document FAILED and rethrows when chunking produces no content', async () => {
    const prisma = buildPrismaMock();
    const service = new KnowledgeService(prisma as never, eventsMock as never, embeddingsMock as never, vectorSearchMock as never, buildAuditMock() as never);

    await expect(service.ingestDocument('src-1', { title: 'Empty', content: '   ' })).rejects.toThrow(
      'Document produced no chunks after parsing',
    );
  });

  it('strips markdown syntax before chunking markdown documents', async () => {
    const prisma = buildPrismaMock();
    const service = new KnowledgeService(prisma as never, eventsMock as never, embeddingsMock as never, vectorSearchMock as never, buildAuditMock() as never);

    await service.ingestDocument('src-1', {
      title: 'Readme',
      content: '# Heading\n\nSome **bold** and _italic_ text with a [link](https://example.com).',
      contentType: 'text/markdown',
    });

    const chunkCall = (prisma.aiDocumentChunk.create as jest.Mock).mock.calls[0][0] as { data: { content: string } };
    expect(chunkCall.data.content).not.toContain('#');
    expect(chunkCall.data.content).not.toContain('**');
  });

  it('delegates semantic search to the vector search service', async () => {
    const prisma = buildPrismaMock();
    const service = new KnowledgeService(prisma as never, eventsMock as never, embeddingsMock as never, vectorSearchMock as never, buildAuditMock() as never);
    vectorSearchMock.search.mockResolvedValueOnce([
      { chunkId: 'c1', documentId: 'd1', documentVersion: 1, sourceId: 's1', sourceCode: 'docs', sourceName: 'Docs', documentTitle: 'T', content: 'hi', score: 0.9 },
    ]);

    const results = await service.search('how do wallets work?', { topK: 3 });
    expect(vectorSearchMock.search).toHaveBeenCalledWith('how do wallets work?', { topK: 3 });
    expect(results).toHaveLength(1);
  });

  it('throws NotFoundError for an unknown source', async () => {
    const prisma = buildPrismaMock();
    prisma.aiKnowledgeSource.findUnique.mockResolvedValueOnce(null);
    const service = new KnowledgeService(prisma as never, eventsMock as never, embeddingsMock as never, vectorSearchMock as never, buildAuditMock() as never);
    await expect(service.getSource('missing')).rejects.toThrow(NotFoundError);
  });

  it('ingesting a document with a duplicate title updates and reindexes the existing document instead of duplicating it', async () => {
    const prisma = buildPrismaMock();
    const audit = buildAuditMock();
    const service = new KnowledgeService(prisma as never, eventsMock as never, embeddingsMock as never, vectorSearchMock as never, audit as never);

    const content = 'Auvora Wallet lets users hold and transfer digital assets. '.repeat(20);
    const first = await service.ingestDocument('src-1', { title: 'Overview', content });
    expect(first.version).toBe(1);

    const second = await service.ingestDocument('src-1', { title: 'Overview', content: `${content} Updated.` });
    expect(second.id).toBe(first.id);
    expect(second.version).toBe(2);
    expect(audit.record).toHaveBeenCalledWith('ai.knowledge.document_updated', expect.objectContaining({ resourceId: first.id }));
  });
});
