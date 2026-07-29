import { trace, SpanStatusCode } from '@opentelemetry/api';
import { Logger } from '@nestjs/common';
import { redactRpcUrl } from './alchemy-rpc.config';

export type JsonRpcMetrics = {
  requests: number;
  errors: number;
  retries: number;
  totalLatencyMs: number;
  lastSuccessAt?: string;
  lastErrorAt?: string;
  lastErrorMessage?: string;
};

export type JsonRpcClientOptions = {
  timeoutMs?: number;
  maxRetries?: number;
  metrics?: JsonRpcMetrics;
  label?: string;
};

export class JsonRpcError extends Error {
  constructor(
    message: string,
    readonly code?: number,
    readonly data?: unknown,
    readonly kind: 'rpc' | 'http' | 'timeout' | 'unauthorized' | 'rate_limit' | 'network' = 'rpc',
  ) {
    super(message);
    this.name = 'JsonRpcError';
  }
}

const tracer = trace.getTracer('auvora-blockchain-rpc');

/**
 * Minimal JSON-RPC 2.0 client with timeout + retry.
 * Never logs full RPC URLs (API keys live in the path).
 */
export class JsonRpcClient {
  private readonly timeoutMs: number;
  private readonly maxRetries: number;
  private readonly metrics: JsonRpcMetrics;
  private readonly label: string;
  private readonly logger = new Logger('JsonRpcClient');

  constructor(
    private readonly rpcUrl: string,
    options: JsonRpcClientOptions = {},
  ) {
    this.timeoutMs = options.timeoutMs ?? 12_000;
    this.maxRetries = options.maxRetries ?? 2;
    this.metrics = options.metrics ?? {
      requests: 0,
      errors: 0,
      retries: 0,
      totalLatencyMs: 0,
    };
    this.label = options.label ?? redactRpcUrl(rpcUrl);
  }

  getMetrics(): JsonRpcMetrics {
    return { ...this.metrics };
  }

  getSafeEndpoint(): string {
    return this.label;
  }

  async call<T>(method: string, params: unknown[] = []): Promise<T> {
    return tracer.startActiveSpan(`rpc.${method}`, async (span) => {
      span.setAttribute('rpc.system', 'jsonrpc');
      span.setAttribute('rpc.method', method);
      span.setAttribute('rpc.endpoint', this.label);
      try {
        const result = await this.callWithRetry<T>(method, params);
        span.setStatus({ code: SpanStatusCode.OK });
        return result;
      } catch (error) {
        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: error instanceof Error ? error.message.slice(0, 200) : 'rpc_error',
        });
        span.recordException(error instanceof Error ? error : new Error(String(error)));
        throw error;
      } finally {
        span.end();
      }
    });
  }

  private async callWithRetry<T>(method: string, params: unknown[]): Promise<T> {
    let attempt = 0;
    let lastError: unknown;
    while (attempt <= this.maxRetries) {
      const started = Date.now();
      this.metrics.requests += 1;
      try {
        const result = await this.once<T>(method, params);
        this.metrics.totalLatencyMs += Date.now() - started;
        this.metrics.lastSuccessAt = new Date().toISOString();
        return result;
      } catch (error) {
        this.metrics.errors += 1;
        this.metrics.totalLatencyMs += Date.now() - started;
        this.metrics.lastErrorAt = new Date().toISOString();
        this.metrics.lastErrorMessage =
          error instanceof Error ? error.message.slice(0, 200) : 'rpc_error';
        lastError = error;
        const nonRetryable = error instanceof JsonRpcError && error.kind === 'unauthorized';
        if (nonRetryable || attempt >= this.maxRetries) {
          break;
        }
        this.metrics.retries += 1;
        this.logger.warn(
          `RPC retry ${attempt + 1}/${this.maxRetries} method=${method} endpoint=${this.label}`,
        );
        attempt += 1;
        await new Promise((r) => setTimeout(r, 150 * attempt));
      }
    }
    throw lastError instanceof Error ? lastError : new Error(String(lastError));
  }

  private async once<T>(method: string, params: unknown[]): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await fetch(this.rpcUrl, {
        method: 'POST',
        headers: { 'content-type': 'application/json', accept: 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
        signal: controller.signal,
      });
      if (response.status === 401 || response.status === 403) {
        throw new JsonRpcError(
          `Alchemy authentication failed (HTTP ${response.status}) for ${this.label} — check ALCHEMY_API_KEY`,
          response.status,
          undefined,
          'unauthorized',
        );
      }
      if (response.status === 429) {
        throw new JsonRpcError(
          `Alchemy rate limit exceeded (HTTP 429) for ${this.label}`,
          429,
          undefined,
          'rate_limit',
        );
      }
      if (response.status >= 500) {
        throw new JsonRpcError(
          `Alchemy / RPC outage (HTTP ${response.status}) for ${this.label}`,
          response.status,
          undefined,
          'network',
        );
      }
      if (!response.ok) {
        throw new JsonRpcError(
          `RPC HTTP ${response.status} from ${this.label}`,
          response.status,
          undefined,
          'http',
        );
      }
      const payload = (await response.json()) as {
        result?: T;
        error?: { code?: number; message?: string; data?: unknown };
      };
      if (payload.error) {
        const msg = (payload.error.message ?? '').toLowerCase();
        const kind =
          msg.includes('rate') || payload.error.code === 429
            ? 'rate_limit'
            : msg.includes('unauthorized') || msg.includes('api key')
              ? 'unauthorized'
              : 'rpc';
        throw new JsonRpcError(
          payload.error.message ?? `RPC error from ${this.label}`,
          payload.error.code,
          payload.error.data,
          kind,
        );
      }
      return payload.result as T;
    } catch (error) {
      if (error instanceof JsonRpcError) throw error;
      if (error instanceof Error && error.name === 'AbortError') {
        throw new JsonRpcError(
          `RPC timeout after ${this.timeoutMs}ms for ${this.label}`,
          undefined,
          undefined,
          'timeout',
        );
      }
      throw new JsonRpcError(
        `RPC network failure for ${this.label}: ${error instanceof Error ? error.message : String(error)}`,
        undefined,
        undefined,
        'network',
      );
    } finally {
      clearTimeout(timer);
    }
  }
}
