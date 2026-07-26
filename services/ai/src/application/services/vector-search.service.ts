import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '@auvora/database';
import type { ModelRouterPort } from '../../domain';
import { cosineSimilarity } from '../../domain';
import { MODEL_ROUTER } from '../ports/provider.tokens';

export interface KnowledgeSearchResult {
  chunkId: string;
  documentId: string;
  documentVersion: number;
  sourceId: string;
  sourceCode: string;
  sourceName: string;
  documentTitle: string;
  content: string;
  score: number;
}

@Injectable()
export class VectorSearchService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(MODEL_ROUTER) private readonly router: ModelRouterPort,
  ) {}

  /** Embeds `query` and ranks it against every stored `AiEmbedding` vector via in-DB cosine similarity. */
  async search(
    query: string,
    options: { sourceIds?: string[]; topK?: number; providerCode?: string } = {},
  ): Promise<KnowledgeSearchResult[]> {
    const topK = Math.min(options.topK ?? 5, 20);
    const provider = await this.router.resolve(options.providerCode);
    const embedResult = await provider.embed({ input: [query] });
    const queryVector = embedResult.vectors[0] ?? [];
    if (queryVector.length === 0) {
      return [];
    }

    const embeddings = await this.prisma.aiEmbedding.findMany({
      where: {
        chunk: {
          document: {
            status: 'INDEXED',
            source: {
              isEnabled: true,
              ...(options.sourceIds?.length ? { id: { in: options.sourceIds } } : {}),
            },
          },
        },
      },
      include: {
        chunk: {
          include: {
            document: { include: { source: true } },
          },
        },
      },
      take: 5_000,
    });

    const scored = embeddings
      .map((embedding) => ({
        embedding,
        score: cosineSimilarity(queryVector, embedding.vector as number[]),
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);

    return scored.map(({ embedding, score }) => ({
      chunkId: embedding.chunk.id,
      documentId: embedding.chunk.document.id,
      documentVersion: embedding.chunk.document.version,
      sourceId: embedding.chunk.document.source.id,
      sourceCode: embedding.chunk.document.source.code,
      sourceName: embedding.chunk.document.source.name,
      documentTitle: embedding.chunk.document.title,
      content: embedding.chunk.content,
      score,
    }));
  }
}
