export interface ChunkOptions {
  size: number;
  overlap: number;
}

const DEFAULT_CHUNK_OPTIONS: ChunkOptions = { size: 800, overlap: 100 };

/** Splits text into overlapping fixed-size chunks (character-based) for embedding/indexing. */
export function chunkText(text: string, options: Partial<ChunkOptions> = {}): string[] {
  const { size, overlap } = { ...DEFAULT_CHUNK_OPTIONS, ...options };
  if (size <= 0) {
    throw new Error('Chunk size must be positive');
  }
  if (overlap < 0 || overlap >= size) {
    throw new Error('Chunk overlap must be non-negative and smaller than chunk size');
  }

  const trimmed = text.trim();
  if (trimmed.length === 0) {
    return [];
  }

  const chunks: string[] = [];
  const step = size - overlap;
  for (let start = 0; start < trimmed.length; start += step) {
    const chunk = trimmed.slice(start, start + size).trim();
    if (chunk.length > 0) {
      chunks.push(chunk);
    }
    if (start + size >= trimmed.length) {
      break;
    }
  }
  return chunks;
}

/** Cosine similarity between two equal-length numeric vectors, in [-1, 1]. Returns 0 for zero vectors. */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error('Vectors must have the same dimensions');
  }
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i += 1) {
    const ai = a[i] ?? 0;
    const bi = b[i] ?? 0;
    dot += ai * bi;
    normA += ai * ai;
    normB += bi * bi;
  }
  if (normA === 0 || normB === 0) {
    return 0;
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

export interface ScoredChunk<T> {
  item: T;
  score: number;
}

/** Ranks candidate items by cosine similarity of their vector against a query vector, descending. */
export function rankByCosineSimilarity<T>(
  queryVector: number[],
  candidates: Array<{ item: T; vector: number[] }>,
  topK = 5,
): ScoredChunk<T>[] {
  return candidates
    .map(({ item, vector }) => ({ item, score: cosineSimilarity(queryVector, vector) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);
}
