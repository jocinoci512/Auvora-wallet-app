import { chunkText, cosineSimilarity, rankByCosineSimilarity } from './rag';

describe('rag', () => {
  describe('chunkText', () => {
    it('returns an empty array for empty input', () => {
      expect(chunkText('   ')).toEqual([]);
    });

    it('returns a single chunk when text is shorter than chunk size', () => {
      expect(chunkText('hello world', { size: 100, overlap: 10 })).toEqual(['hello world']);
    });

    it('splits long text into overlapping chunks', () => {
      const text = 'a'.repeat(25);
      const chunks = chunkText(text, { size: 10, overlap: 2 });
      expect(chunks.length).toBeGreaterThan(1);
      for (const chunk of chunks) {
        expect(chunk.length).toBeLessThanOrEqual(10);
      }
    });

    it('throws for invalid chunk size', () => {
      expect(() => chunkText('hello', { size: 0, overlap: 0 })).toThrow();
    });

    it('throws when overlap is not smaller than size', () => {
      expect(() => chunkText('hello', { size: 5, overlap: 5 })).toThrow();
    });
  });

  describe('cosineSimilarity', () => {
    it('returns 1 for identical vectors', () => {
      expect(cosineSimilarity([1, 2, 3], [1, 2, 3])).toBeCloseTo(1);
    });

    it('returns 0 for orthogonal vectors', () => {
      expect(cosineSimilarity([1, 0], [0, 1])).toBeCloseTo(0);
    });

    it('returns -1 for opposite vectors', () => {
      expect(cosineSimilarity([1, 0], [-1, 0])).toBeCloseTo(-1);
    });

    it('returns 0 for a zero vector', () => {
      expect(cosineSimilarity([0, 0], [1, 1])).toBe(0);
    });

    it('throws for mismatched dimensions', () => {
      expect(() => cosineSimilarity([1, 2], [1, 2, 3])).toThrow();
    });
  });

  describe('rankByCosineSimilarity', () => {
    it('ranks candidates by descending similarity and truncates to topK', () => {
      const query = [1, 0];
      const candidates = [
        { item: 'orthogonal', vector: [0, 1] },
        { item: 'same', vector: [1, 0] },
        { item: 'opposite', vector: [-1, 0] },
      ];
      const results = rankByCosineSimilarity(query, candidates, 2);
      expect(results).toHaveLength(2);
      expect(results[0].item).toBe('same');
      expect(results[0].score).toBeCloseTo(1);
    });
  });
});
