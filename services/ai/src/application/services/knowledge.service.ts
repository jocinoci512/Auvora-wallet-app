import { createHash } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { PrismaService, type AiKnowledgeSourceType, type Prisma } from '@auvora/database';
import { AiEventType, chunkText, EVENT_BUS, NotFoundError, type EventBusPort } from '../../domain';
import { AuditService } from './audit.service';
import { EmbeddingService } from './embedding.service';
import { VectorSearchService, type KnowledgeSearchResult } from './vector-search.service';

export interface CreateKnowledgeSourceInput {
  code: string;
  name: string;
  description?: string;
  sourceType: AiKnowledgeSourceType;
  metadata?: Record<string, unknown>;
}

export interface IngestDocumentInput {
  title: string;
  content: string;
  contentType?: string;
  chunkSize?: number;
  chunkOverlap?: number;
  providerCode?: string;
}

/** Strips the most common Markdown syntax so headings/emphasis/links don't pollute embeddings or search snippets. */
function stripMarkdown(content: string): string {
  return content
    .replace(/```[\s\S]*?```/g, (block) => block.replace(/```/g, ''))
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/(\*\*|__)(.*?)\1/g, '$2')
    .replace(/(\*|_)(.*?)\1/g, '$2')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/^>\s?/gm, '');
}

@Injectable()
export class KnowledgeService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(EVENT_BUS) private readonly events: EventBusPort,
    @Inject(EmbeddingService) private readonly embeddings: EmbeddingService,
    @Inject(VectorSearchService) private readonly vectorSearch: VectorSearchService,
    @Inject(AuditService) private readonly audit: AuditService,
  ) {}

  async listSources(filters: { isEnabled?: boolean; skip?: number; take?: number } = {}) {
    const skip = filters.skip ?? 0;
    const take = Math.min(filters.take ?? 50, 200);
    const where: Prisma.AiKnowledgeSourceWhereInput = filters.isEnabled === undefined ? {} : { isEnabled: filters.isEnabled };
    const [items, total] = await Promise.all([
      this.prisma.aiKnowledgeSource.findMany({ where, orderBy: { createdAt: 'desc' }, skip, take }),
      this.prisma.aiKnowledgeSource.count({ where }),
    ]);
    return { items, total, skip, take };
  }

  async getSource(id: string) {
    const source = await this.prisma.aiKnowledgeSource.findUnique({ where: { id } });
    if (!source) throw new NotFoundError('Knowledge source not found');
    return source;
  }

  async createSource(input: CreateKnowledgeSourceInput) {
    return this.prisma.aiKnowledgeSource.create({
      data: {
        code: input.code,
        name: input.name,
        description: input.description,
        sourceType: input.sourceType,
        isEnabled: true,
        version: 1,
        metadata: (input.metadata ?? {}) as Prisma.InputJsonValue,
      },
    });
  }

  async setSourceEnabled(id: string, isEnabled: boolean, actorUserId?: string) {
    await this.getSource(id);
    const updated = await this.prisma.aiKnowledgeSource.update({ where: { id }, data: { isEnabled } });
    await this.audit.record('ai.knowledge.source_enabled_changed', {
      actorUserId,
      resourceType: 'AiKnowledgeSource',
      resourceId: id,
      details: { isEnabled },
    });
    return updated;
  }

  async listDocuments(sourceId: string, filters: { skip?: number; take?: number } = {}) {
    await this.getSource(sourceId);
    const skip = filters.skip ?? 0;
    const take = Math.min(filters.take ?? 50, 200);
    const where: Prisma.AiDocumentWhereInput = { sourceId };
    const [items, total] = await Promise.all([
      this.prisma.aiDocument.findMany({ where, orderBy: { updatedAt: 'desc' }, skip, take }),
      this.prisma.aiDocument.count({ where }),
    ]);
    return { items, total, skip, take };
  }

  async getDocument(id: string) {
    const document = await this.prisma.aiDocument.findUnique({ where: { id } });
    if (!document) throw new NotFoundError('Document not found');
    return document;
  }

  /**
   * Ingests plain-text/Markdown content: parses, chunks, embeds, and indexes it in one pass. If a
   * document with the same title already exists in this source, delegates to `upsertDocument`
   * instead of creating a duplicate — the existing document's content is updated and its version
   * bumped, then it is fully reindexed.
   */
  async ingestDocument(sourceId: string, input: IngestDocumentInput, actorUserId?: string) {
    await this.getSource(sourceId);
    const existing = await this.prisma.aiDocument.findFirst({ where: { sourceId, title: input.title } });
    if (existing) {
      return this.upsertDocument(existing.id, input, actorUserId);
    }

    const contentType = input.contentType ?? 'text/plain';
    const checksum = createHash('sha256').update(input.content).digest('hex');

    const document = await this.prisma.aiDocument.create({
      data: {
        sourceId,
        title: input.title,
        contentType,
        content: input.content,
        status: 'PARSING',
        version: 1,
        checksum,
      },
    });
    await this.audit.record('ai.knowledge.document_ingested', {
      actorUserId,
      resourceType: 'AiDocument',
      resourceId: document.id,
      details: { sourceId, title: input.title },
    });

    return this.indexDocument(document.id, input);
  }

  /** Replaces an existing document's content in place, bumping its version and fully reindexing it. */
  async upsertDocument(documentId: string, input: IngestDocumentInput, actorUserId?: string) {
    const document = await this.getDocument(documentId);
    const contentType = input.contentType ?? document.contentType;
    const checksum = createHash('sha256').update(input.content).digest('hex');
    const nextVersion = document.version + 1;

    await this.prisma.aiDocumentChunk.deleteMany({ where: { documentId } });
    await this.prisma.aiDocument.update({
      where: { id: documentId },
      data: { content: input.content, contentType, checksum, version: nextVersion, status: 'PARSING' },
    });
    await this.audit.record('ai.knowledge.document_updated', {
      actorUserId,
      resourceType: 'AiDocument',
      resourceId: documentId,
      details: { version: nextVersion },
    });

    return this.indexDocument(documentId, input);
  }

  async reindexDocument(
    documentId: string,
    options: { chunkSize?: number; chunkOverlap?: number; providerCode?: string } = {},
    actorUserId?: string,
  ) {
    const document = await this.getDocument(documentId);
    await this.prisma.aiDocumentChunk.deleteMany({ where: { documentId } });
    const nextVersion = document.version + 1;
    await this.prisma.aiDocument.update({ where: { id: documentId }, data: { version: nextVersion, status: 'PARSING' } });
    await this.audit.record('ai.knowledge.document_reindexed', {
      actorUserId,
      resourceType: 'AiDocument',
      resourceId: documentId,
      details: { version: nextVersion },
    });
    return this.indexDocument(documentId, options);
  }

  private async indexDocument(
    documentId: string,
    options: { chunkSize?: number; chunkOverlap?: number; providerCode?: string },
  ) {
    const document = await this.getDocument(documentId);
    try {
      const parsed = document.contentType.includes('markdown') ? stripMarkdown(document.content) : document.content;
      await this.prisma.aiDocument.update({ where: { id: documentId }, data: { status: 'CHUNKING' } });

      const chunks = chunkText(parsed, { size: options.chunkSize ?? 800, overlap: options.chunkOverlap ?? 100 });
      if (chunks.length === 0) {
        throw new Error('Document produced no chunks after parsing');
      }

      await this.prisma.aiDocument.update({ where: { id: documentId }, data: { status: 'EMBEDDING' } });
      const embedResult = await this.embeddings.embed(chunks, { providerCode: options.providerCode });

      for (let i = 0; i < chunks.length; i += 1) {
        const chunkContent = chunks[i] ?? '';
        const chunk = await this.prisma.aiDocumentChunk.create({
          data: {
            documentId,
            chunkIndex: i,
            content: chunkContent,
            tokenCount: Math.ceil(chunkContent.length / 4),
          },
        });
        await this.prisma.aiEmbedding.create({
          data: {
            chunkId: chunk.id,
            model: embedResult.model,
            dimensions: embedResult.dimensions,
            vector: embedResult.vectors[i] as unknown as Prisma.InputJsonValue,
            providerCode: embedResult.providerCode,
          },
        });
      }

      const indexed = await this.prisma.aiDocument.update({
        where: { id: documentId },
        data: { status: 'INDEXED', indexedAt: new Date(), errorMessage: null },
      });

      await this.bumpVectorIndexMeta(embedResult.model, embedResult.dimensions);

      await this.events.publish({
        type: AiEventType.DocumentIndexed,
        aggregateId: documentId,
        payload: { sourceId: document.sourceId, chunkCount: chunks.length },
      });

      return indexed;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await this.prisma.aiDocument.update({ where: { id: documentId }, data: { status: 'FAILED', errorMessage: message } });
      await this.events.publish({
        type: AiEventType.DocumentIndexFailed,
        aggregateId: documentId,
        payload: { sourceId: document.sourceId, error: message },
      });
      throw error;
    }
  }

  private async bumpVectorIndexMeta(model: string, dimensions: number) {
    const [documentCount, chunkCount] = await Promise.all([
      this.prisma.aiDocument.count({ where: { status: 'INDEXED' } }),
      this.prisma.aiDocumentChunk.count(),
    ]);
    await this.prisma.aiVectorIndexMeta.upsert({
      where: { code: 'default' },
      create: {
        code: 'default',
        name: 'Default Vector Index',
        model,
        dimensions,
        documentCount,
        chunkCount,
        lastRefreshAt: new Date(),
      },
      update: { model, dimensions, documentCount, chunkCount, lastRefreshAt: new Date() },
    });
  }

  async search(
    query: string,
    options: { sourceIds?: string[]; topK?: number; providerCode?: string } = {},
  ): Promise<KnowledgeSearchResult[]> {
    return this.vectorSearch.search(query, options);
  }

  /** Refresh job: reindexes every non-indexed/failed document in a source and bumps its version. */
  async refreshSource(sourceId: string) {
    const source = await this.getSource(sourceId);
    const documents = await this.prisma.aiDocument.findMany({
      where: { sourceId, status: { in: ['PENDING', 'FAILED'] } },
    });

    const results = [];
    for (const document of documents) {
      try {
        await this.indexDocument(document.id, {});
        results.push({ documentId: document.id, success: true });
      } catch (error) {
        results.push({ documentId: document.id, success: false, error: error instanceof Error ? error.message : String(error) });
      }
    }

    const updatedSource = await this.prisma.aiKnowledgeSource.update({
      where: { id: sourceId },
      data: { version: source.version + 1 },
    });

    await this.events.publish({
      type: AiEventType.KnowledgeSourceRefreshed,
      aggregateId: sourceId,
      payload: { documentsProcessed: results.length },
    });

    return { source: updatedSource, results };
  }
}
