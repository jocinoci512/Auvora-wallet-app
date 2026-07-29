import {
  Bulkhead,
  BulkheadFullError,
  CircuitBreaker,
  CircuitOpenError,
  TimeoutError,
  computeBackoffDelayMs,
  createMetrics,
  resilientCall,
  withRetry,
  withTimeout,
} from './index';

describe('@auvora/resilience', () => {
  it('computes exponential backoff with cap', () => {
    const delay = computeBackoffDelayMs(5, { baseDelayMs: 100, maxDelayMs: 500, jitter: false });
    expect(delay).toBe(500);
  });

  it('times out slow operations', async () => {
    await expect(
      withTimeout(async () => {
        await new Promise((r) => setTimeout(r, 50));
        return 'ok';
      }, 10),
    ).rejects.toBeInstanceOf(TimeoutError);
  });

  it('retries failing operations', async () => {
    let attempts = 0;
    const metrics = createMetrics();
    const value = await withRetry(
      async () => {
        attempts += 1;
        if (attempts < 3) {
          throw new Error('transient');
        }
        return 'ok';
      },
      { maxAttempts: 3, backoff: { baseDelayMs: 1, jitter: false }, metrics },
    );
    expect(value).toBe('ok');
    expect(attempts).toBe(3);
    expect(metrics.retries).toBe(2);
  });

  it('opens circuit after failures and uses fallback', async () => {
    const metrics = createMetrics();
    const breaker = new CircuitBreaker('demo', {
      failureThreshold: 2,
      resetTimeoutMs: 60_000,
      metrics,
    });
    await expect(
      breaker.exec(async () => {
        throw new Error('down');
      }),
    ).rejects.toThrow('down');
    await expect(
      breaker.exec(async () => {
        throw new Error('down');
      }),
    ).rejects.toThrow('down');
    expect(breaker.getState()).toBe('open');
    const result = await breaker.exec(
      async () => 'should-not-run',
      () => 'fallback',
    );
    expect(result).toBe('fallback');
    expect(metrics.circuitOpens).toBeGreaterThanOrEqual(1);
  });

  it('rejects when bulkhead is full', async () => {
    const bulkhead = new Bulkhead('workers', { maxConcurrent: 1 });
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const first = bulkhead.exec(async () => {
      await gate;
      return 'one';
    });
    await expect(bulkhead.exec(async () => 'two')).rejects.toBeInstanceOf(BulkheadFullError);
    release();
    await expect(first).resolves.toBe('one');
  });

  it('composes resilientCall with timeout and fallback', async () => {
    const metrics = createMetrics();
    const value = await resilientCall(
      async () => {
        await new Promise((r) => setTimeout(r, 30));
        return 'slow';
      },
      {
        timeoutMs: 5,
        fallback: () => 'degraded',
        metrics,
      },
    );
    expect(value).toBe('degraded');
    expect(metrics.timeouts + metrics.fallbacks).toBeGreaterThan(0);
  });

  it('throws CircuitOpenError without fallback', async () => {
    const breaker = new CircuitBreaker('x', { failureThreshold: 1, resetTimeoutMs: 60_000 });
    await expect(
      breaker.exec(async () => {
        throw new Error('fail');
      }),
    ).rejects.toThrow('fail');
    await expect(breaker.exec(async () => 'nope')).rejects.toBeInstanceOf(CircuitOpenError);
  });
});
