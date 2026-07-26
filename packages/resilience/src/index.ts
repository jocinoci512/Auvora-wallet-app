export type ResilienceMetrics = {
  successes: number;
  failures: number;
  retries: number;
  timeouts: number;
  circuitOpens: number;
  circuitRejects: number;
  bulkheadRejects: number;
  fallbacks: number;
};

export function createMetrics(): ResilienceMetrics {
  return {
    successes: 0,
    failures: 0,
    retries: 0,
    timeouts: 0,
    circuitOpens: 0,
    circuitRejects: 0,
    bulkheadRejects: 0,
    fallbacks: 0,
  };
}

function bump(metrics: ResilienceMetrics | undefined, key: keyof ResilienceMetrics): void {
  if (metrics) {
    metrics[key] += 1;
  }
}

export class TimeoutError extends Error {
  constructor(message = 'Operation timed out') {
    super(message);
    this.name = 'TimeoutError';
  }
}

export class CircuitOpenError extends Error {
  constructor(message = 'Circuit breaker is open') {
    super(message);
    this.name = 'CircuitOpenError';
  }
}

export class BulkheadFullError extends Error {
  constructor(message = 'Bulkhead is full') {
    super(message);
    this.name = 'BulkheadFullError';
  }
}

export type BackoffOptions = {
  baseDelayMs?: number;
  maxDelayMs?: number;
  factor?: number;
  jitter?: boolean;
};

export function computeBackoffDelayMs(attempt: number, options: BackoffOptions = {}): number {
  const base = options.baseDelayMs ?? 100;
  const max = options.maxDelayMs ?? 30_000;
  const factor = options.factor ?? 2;
  const exp = Math.max(0, attempt - 1);
  let delay = Math.min(max, base * factor ** exp);
  if (options.jitter !== false) {
    delay = Math.floor(delay * (0.5 + Math.random() * 0.5));
  }
  return delay;
}

export async function withTimeout<T>(
  fn: (signal: AbortSignal) => Promise<T>,
  timeoutMs: number,
  metrics?: ResilienceMetrics,
): Promise<T> {
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);
  try {
    const result = await Promise.race([
      fn(controller.signal),
      new Promise<never>((_resolve, reject) => {
        controller.signal.addEventListener(
          'abort',
          () => reject(new TimeoutError(`Timed out after ${timeoutMs}ms`)),
          { once: true },
        );
      }),
    ]);
    return result;
  } catch (error) {
    if (timedOut || error instanceof TimeoutError) {
      bump(metrics, 'timeouts');
      throw error instanceof TimeoutError
        ? error
        : new TimeoutError(`Timed out after ${timeoutMs}ms`);
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

export type RetryOptions = {
  maxAttempts?: number;
  backoff?: BackoffOptions;
  retryIf?: (error: unknown) => boolean;
  metrics?: ResilienceMetrics;
};

export async function withRetry<T>(fn: () => Promise<T>, options: RetryOptions = {}): Promise<T> {
  const maxAttempts = options.maxAttempts ?? 3;
  const retryIf = options.retryIf ?? (() => true);
  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const result = await fn();
      bump(options.metrics, 'successes');
      return result;
    } catch (error) {
      lastError = error;
      bump(options.metrics, 'failures');
      if (attempt >= maxAttempts || !retryIf(error)) {
        throw error;
      }
      bump(options.metrics, 'retries');
      const delay = computeBackoffDelayMs(attempt, options.backoff);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
  throw lastError;
}

export type CircuitState = 'closed' | 'open' | 'half-open';

export type CircuitBreakerOptions = {
  failureThreshold?: number;
  successThreshold?: number;
  resetTimeoutMs?: number;
  metrics?: ResilienceMetrics;
};

export class CircuitBreaker {
  private state: CircuitState = 'closed';
  private failures = 0;
  private successes = 0;
  private openedAt = 0;
  private readonly failureThreshold: number;
  private readonly successThreshold: number;
  private readonly resetTimeoutMs: number;
  private readonly metrics?: ResilienceMetrics;

  constructor(
    private readonly name: string,
    options: CircuitBreakerOptions = {},
  ) {
    this.failureThreshold = options.failureThreshold ?? 5;
    this.successThreshold = options.successThreshold ?? 2;
    this.resetTimeoutMs = options.resetTimeoutMs ?? 30_000;
    this.metrics = options.metrics;
  }

  getState(): CircuitState {
    this.maybeHalfOpen();
    return this.state;
  }

  getName(): string {
    return this.name;
  }

  async exec<T>(fn: () => Promise<T>, fallback?: () => Promise<T> | T): Promise<T> {
    this.maybeHalfOpen();
    if (this.state === 'open') {
      bump(this.metrics, 'circuitRejects');
      if (fallback) {
        bump(this.metrics, 'fallbacks');
        return await fallback();
      }
      throw new CircuitOpenError(`Circuit '${this.name}' is open`);
    }

    try {
      const result = await fn();
      this.onSuccess();
      bump(this.metrics, 'successes');
      return result;
    } catch (error) {
      this.onFailure();
      bump(this.metrics, 'failures');
      if (fallback) {
        bump(this.metrics, 'fallbacks');
        return await fallback();
      }
      throw error;
    }
  }

  private maybeHalfOpen(): void {
    if (this.state === 'open' && Date.now() - this.openedAt >= this.resetTimeoutMs) {
      this.state = 'half-open';
      this.successes = 0;
    }
  }

  private onSuccess(): void {
    if (this.state === 'half-open') {
      this.successes += 1;
      if (this.successes >= this.successThreshold) {
        this.state = 'closed';
        this.failures = 0;
      }
      return;
    }
    this.failures = 0;
  }

  private onFailure(): void {
    this.failures += 1;
    if (this.state === 'half-open' || this.failures >= this.failureThreshold) {
      this.state = 'open';
      this.openedAt = Date.now();
      bump(this.metrics, 'circuitOpens');
    }
  }
}

export type BulkheadOptions = {
  maxConcurrent?: number;
  metrics?: ResilienceMetrics;
};

export class Bulkhead {
  private inflight = 0;
  private readonly maxConcurrent: number;
  private readonly metrics?: ResilienceMetrics;

  constructor(
    private readonly name: string,
    options: BulkheadOptions = {},
  ) {
    this.maxConcurrent = options.maxConcurrent ?? 10;
    this.metrics = options.metrics;
  }

  getInflight(): number {
    return this.inflight;
  }

  async exec<T>(fn: () => Promise<T>): Promise<T> {
    if (this.inflight >= this.maxConcurrent) {
      bump(this.metrics, 'bulkheadRejects');
      throw new BulkheadFullError(`Bulkhead '${this.name}' is full (${this.maxConcurrent})`);
    }
    this.inflight += 1;
    try {
      return await fn();
    } finally {
      this.inflight -= 1;
    }
  }
}

export type ResilientCallOptions = {
  timeoutMs?: number;
  retry?: RetryOptions;
  circuit?: CircuitBreaker;
  bulkhead?: Bulkhead;
  fallback?: () => Promise<unknown> | unknown;
  metrics?: ResilienceMetrics;
};

export async function resilientCall<T>(
  fn: (signal?: AbortSignal) => Promise<T>,
  options: ResilientCallOptions = {},
): Promise<T> {
  const run = async (): Promise<T> => {
    const invoke = async (): Promise<T> => {
      if (options.timeoutMs) {
        return withTimeout((signal) => fn(signal), options.timeoutMs, options.metrics);
      }
      return fn();
    };

    const withBulkhead = async (): Promise<T> => {
      if (options.bulkhead) {
        return options.bulkhead.exec(invoke);
      }
      return invoke();
    };

    if (options.retry) {
      return withRetry(withBulkhead, { ...options.retry, metrics: options.metrics });
    }
    return withBulkhead();
  };

  if (options.circuit) {
    return options.circuit.exec(run, options.fallback as (() => Promise<T> | T) | undefined);
  }

  try {
    return await run();
  } catch (error) {
    if (options.fallback) {
      bump(options.metrics, 'fallbacks');
      return (await options.fallback()) as T;
    }
    throw error;
  }
}
