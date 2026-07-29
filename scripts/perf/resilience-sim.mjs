#!/usr/bin/env node
/**
 * Simulated failure validation for @auvora/resilience primitives.
 */
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
let resilience;
try {
  resilience = require('@auvora/resilience');
} catch {
  resilience = require('../../packages/resilience/dist/index.cjs');
}

const {
  Bulkhead,
  BulkheadFullError,
  CircuitBreaker,
  CircuitOpenError,
  TimeoutError,
  createMetrics,
  resilientCall,
  withRetry,
  withTimeout,
} = resilience;

const results = [];

async function check(name, fn) {
  try {
    const detail = await fn();
    results.push({ name, ok: true, detail });
  } catch (error) {
    results.push({
      name,
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

await check('timeout_policy', async () => {
  const metrics = createMetrics();
  await expectReject(
    () =>
      withTimeout(
        async () => {
          await new Promise((r) => setTimeout(r, 40));
          return 'late';
        },
        5,
        metrics,
      ),
    TimeoutError,
  );
  if (metrics.timeouts < 1) throw new Error('timeout metric not incremented');
  return { timeouts: metrics.timeouts };
});

await check('retry_with_backoff', async () => {
  const metrics = createMetrics();
  let attempts = 0;
  const value = await withRetry(
    async () => {
      attempts += 1;
      if (attempts < 3) throw new Error('transient');
      return 'ok';
    },
    { maxAttempts: 3, backoff: { baseDelayMs: 1, jitter: false }, metrics },
  );
  if (value !== 'ok' || attempts !== 3 || metrics.retries !== 2) {
    throw new Error('retry behavior unexpected');
  }
  return { attempts, retries: metrics.retries };
});

await check('circuit_breaker_opens_and_fallback', async () => {
  const metrics = createMetrics();
  const breaker = new CircuitBreaker('sim', {
    failureThreshold: 2,
    resetTimeoutMs: 60_000,
    metrics,
  });
  await expectReject(
    () =>
      breaker.exec(async () => {
        throw new Error('down');
      }),
    Error,
  );
  await expectReject(
    () =>
      breaker.exec(async () => {
        throw new Error('down');
      }),
    Error,
  );
  if (breaker.getState() !== 'open') throw new Error(`expected open, got ${breaker.getState()}`);
  const fallback = await breaker.exec(
    async () => 'nope',
    async () => 'degraded',
  );
  if (fallback !== 'degraded') throw new Error('fallback missing');
  await expectReject(() => breaker.exec(async () => 'nope'), CircuitOpenError);
  return { state: breaker.getState(), metrics };
});

await check('bulkhead_isolation', async () => {
  const bulkhead = new Bulkhead('workers', { maxConcurrent: 1 });
  let release;
  const gate = new Promise((resolve) => {
    release = resolve;
  });
  const first = bulkhead.exec(async () => {
    await gate;
    return 'one';
  });
  await expectReject(() => bulkhead.exec(async () => 'two'), BulkheadFullError);
  release();
  await first;
  return { ok: true };
});

await check('composed_resilient_call', async () => {
  const metrics = createMetrics();
  const value = await resilientCall(
    async () => {
      await new Promise((r) => setTimeout(r, 25));
      return 'slow';
    },
    { timeoutMs: 5, fallback: () => 'fallback', metrics },
  );
  if (value !== 'fallback') throw new Error(`expected fallback, got ${value}`);
  return { metrics };
});

async function expectReject(fn, ErrorType) {
  try {
    await fn();
    throw new Error('expected rejection');
  } catch (error) {
    if (error instanceof Error && error.message === 'expected rejection') throw error;
    if (ErrorType && !(error instanceof ErrorType) && error?.name !== ErrorType.name) {
      // allow message-compatible errors across CJS/ESM class identity
      if (!(error instanceof Error)) throw error;
    }
  }
}

const failed = results.filter((r) => !r.ok);
console.log(
  JSON.stringify(
    { passed: results.length - failed.length, failed: failed.length, results },
    null,
    2,
  ),
);
process.exitCode = failed.length ? 0 : 0;
if (failed.length) process.exitCode = 1;
