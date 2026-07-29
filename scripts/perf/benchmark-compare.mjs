#!/usr/bin/env node
/**
 * Before/after benchmark comparison for Phase 13 optimizations.
 * Synthetic microbenchmarks (cache/resilience) + live gateway probes.
 */
import { performance } from 'node:perf_hooks';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

function arg(name, fallback) {
  const idx = process.argv.indexOf(`--${name}`);
  if (idx === -1) return fallback;
  return process.argv[idx + 1] ?? fallback;
}

const base = arg('base', 'http://localhost:4000').replace(/\/$/, '');

async function timeMany(label, iterations, fn) {
  const samples = [];
  for (let i = 0; i < iterations; i += 1) {
    const start = performance.now();
    await fn();
    samples.push(performance.now() - start);
  }
  samples.sort((a, b) => a - b);
  const sum = samples.reduce((a, b) => a + b, 0);
  return {
    label,
    iterations,
    avgMs: Number((sum / samples.length).toFixed(3)),
    p50Ms: Number(samples[Math.floor(samples.length * 0.5)].toFixed(3)),
    p95Ms: Number(samples[Math.floor(samples.length * 0.95)].toFixed(3)),
  };
}

async function liveProbe(path) {
  const url = `${base}${path}`;
  try {
    const start = performance.now();
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    return {
      path,
      ok: res.ok,
      status: res.status,
      ms: Number((performance.now() - start).toFixed(2)),
    };
  } catch (error) {
    return {
      path,
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

// Baseline (pre-optimization) characteristics captured from Phase 12 readiness
const before = {
  notes:
    'Phase 12 baseline: no gateway edge rate limit, no proxyTimeout, AI cache TTL 60s, no shared cache/resilience metrics, health-only probes.',
  gatewayHealthP95Ms: 50, // acceptance floor used pre-optimization documentation
  aiCacheTtlSeconds: 60,
  proxyTimeoutMs: null,
  edgeRateLimit: false,
  sharedCacheHitRatioTracking: false,
  circuitBreakerLibrary: false,
};

let cache;
let resilience;
try {
  cache = require('@auvora/cache');
  resilience = require('@auvora/resilience');
} catch {
  // Resolve from package dist paths when workspace require fails
  cache = require('../../packages/cache/dist/index.cjs');
  resilience = require('../../packages/resilience/dist/index.cjs');
}

const store = new cache.MemoryCacheStore();
const client = new cache.CacheClient({
  store,
  defaultTtlSeconds: cache.CACHE_TTL.aiRequest,
  stats: cache.createCacheStats(),
});

let loaderCalls = 0;
const cached = await timeMany('cache_read_through_hot', 200, async () => {
  await client.getOrSet('bench:key', async () => {
    loaderCalls += 1;
    return { n: loaderCalls };
  });
});

const uncachedLoader = await timeMany('uncached_loader_baseline', 50, async () => {
  await Promise.resolve({ n: Math.random() });
});

const metrics = resilience.createMetrics();
const breaker = new resilience.CircuitBreaker('bench', {
  failureThreshold: 3,
  resetTimeoutMs: 1000,
  metrics,
});

const resilientFallback = await timeMany('resilient_fallback_under_failure', 30, async () => {
  await breaker.exec(
    async () => {
      throw new Error('forced');
    },
    async () => 'fallback',
  );
});

const live = {
  health: await liveProbe('/health'),
  ready: await liveProbe('/ready'),
  swagger: await liveProbe('/api/docs'),
  resilienceMetrics: await liveProbe('/metrics/resilience'),
};

const after = {
  notes:
    'Phase 13: shared cache/resilience, gateway rate limit + 30s proxy timeouts, AI TTL 120s, /metrics/resilience, measurable hit ratios.',
  gatewayHealthP95MsMeasured: null,
  aiCacheTtlSeconds: cache.CACHE_TTL.aiRequest,
  proxyTimeoutMs: 30_000,
  edgeRateLimit: true,
  sharedCacheHitRatioTracking: true,
  circuitBreakerLibrary: true,
  cacheHitRatio: Number(client.hitRatio().toFixed(3)),
  loaderCallsForHotPath: loaderCalls,
};

// Live micro load for health p95
const healthSamples = [];
for (let i = 0; i < 40; i += 1) {
  const start = performance.now();
  try {
    const res = await fetch(`${base}/health`, { signal: AbortSignal.timeout(3000) });
    if (res.ok) healthSamples.push(performance.now() - start);
  } catch {
    // ignore
  }
}
healthSamples.sort((a, b) => a - b);
after.gatewayHealthP95MsMeasured = healthSamples.length
  ? Number(healthSamples[Math.floor(healthSamples.length * 0.95)].toFixed(2))
  : null;

const improvement = {
  healthP95Ms:
    after.gatewayHealthP95MsMeasured == null
      ? null
      : {
          beforeTargetMs: before.gatewayHealthP95Ms,
          afterMeasuredMs: after.gatewayHealthP95MsMeasured,
          improvedVsTarget: after.gatewayHealthP95MsMeasured < before.gatewayHealthP95Ms,
          deltaMs: Number(
            (before.gatewayHealthP95Ms - after.gatewayHealthP95MsMeasured).toFixed(2),
          ),
        },
  aiCacheTtlSeconds: {
    before: before.aiCacheTtlSeconds,
    after: after.aiCacheTtlSeconds,
    change: `+${after.aiCacheTtlSeconds - before.aiCacheTtlSeconds}s default TTL`,
  },
  cacheHotPath: {
    uncachedAvgMs: uncachedLoader.avgMs,
    cachedAvgMs: cached.avgMs,
    loaderInvocations: loaderCalls,
    hitRatio: after.cacheHitRatio,
    note: 'Hot path should invoke loader once; subsequent reads from cache',
  },
  resilience: {
    fallbackAvgMs: resilientFallback.avgMs,
    metrics,
    note: 'Failures trip circuit and serve fallback without unbounded retries',
  },
};

const report = {
  generatedAt: new Date().toISOString(),
  base,
  before,
  after,
  microbenchmarks: { cached, uncachedLoader, resilientFallback },
  live,
  improvement,
};

console.log(JSON.stringify(report, null, 2));
process.exitCode = live.health.ok ? 0 : 1;
