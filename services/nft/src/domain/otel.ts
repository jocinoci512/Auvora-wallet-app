import { context, SpanStatusCode, trace, type Span } from '@opentelemetry/api';

const tracer = trace.getTracer('auvora-nft');

export async function withNftSpan<T>(
  name: string,
  attributes: Record<string, string | number | boolean>,
  fn: (span: Span) => Promise<T>,
): Promise<T> {
  const span = tracer.startSpan(name, { attributes });
  try {
    return await context.with(trace.setSpan(context.active(), span), async () => fn(span));
  } catch (error) {
    span.recordException(error instanceof Error ? error : new Error(String(error)));
    span.setStatus({ code: SpanStatusCode.ERROR });
    throw error;
  } finally {
    span.end();
  }
}

export type NftMetrics = {
  syncDurationMs: number[];
  metadataLatencyMs: number[];
  mediaCacheLatencyMs: number[];
  collectionUpdateLatencyMs: number[];
  workerTickMs: number[];
  cacheHits: number;
  cacheMisses: number;
};

export function createNftMetrics(): NftMetrics {
  return {
    syncDurationMs: [],
    metadataLatencyMs: [],
    mediaCacheLatencyMs: [],
    collectionUpdateLatencyMs: [],
    workerTickMs: [],
    cacheHits: 0,
    cacheMisses: 0,
  };
}

export function pushLatency(bucket: number[], value: number, max = 100): void {
  bucket.push(value);
  if (bucket.length > max) bucket.shift();
}

export function avg(values: number[]): number | null {
  if (!values.length) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

export function cacheHitRatio(metrics: NftMetrics): number | null {
  const total = metrics.cacheHits + metrics.cacheMisses;
  if (!total) return null;
  return metrics.cacheHits / total;
}
