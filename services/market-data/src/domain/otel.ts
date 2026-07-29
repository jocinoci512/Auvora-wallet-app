import { context, SpanStatusCode, trace, type Span } from '@opentelemetry/api';

const tracer = trace.getTracer('auvora-market-data');

export async function withMarketSpan<T>(
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

export type MarketMetrics = {
  priceRefreshLatencyMs: number[];
  providerLatencyMs: number[];
  portfolioCalcMs: number[];
  alertProcessingMs: number[];
  cacheHits: number;
  cacheMisses: number;
};

export function createMarketMetrics(): MarketMetrics {
  return {
    priceRefreshLatencyMs: [],
    providerLatencyMs: [],
    portfolioCalcMs: [],
    alertProcessingMs: [],
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

export function cacheHitRatio(metrics: MarketMetrics): number | null {
  const total = metrics.cacheHits + metrics.cacheMisses;
  if (!total) return null;
  return metrics.cacheHits / total;
}
