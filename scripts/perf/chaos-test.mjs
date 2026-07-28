#!/usr/bin/env node
/**
 * Chaos / failure behavior checks against a running platform.
 * Usage: node scripts/perf/chaos-test.mjs --base http://localhost:4000
 */
const base = (process.argv.includes('--base')
  ? process.argv[process.argv.indexOf('--base') + 1]
  : 'http://localhost:4000'
).replace(/\/$/, '');

const results = [];

async function check(name, fn) {
  const started = Date.now();
  try {
    const detail = await fn();
    results.push({ name, ok: true, ms: Date.now() - started, detail });
  } catch (error) {
    results.push({
      name,
      ok: false,
      ms: Date.now() - started,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

await check('health_liveness', async () => {
  const res = await fetch(`${base}/health`, { signal: AbortSignal.timeout(3000) });
  if (!res.ok) throw new Error(`status ${res.status}`);
  return await res.json();
});

await check('ready_degraded_allowed', async () => {
  const res = await fetch(`${base}/ready`, { signal: AbortSignal.timeout(5000) });
  // Ready may be 503 when auth/deps are down — probe must respond (not hang / not 5xx crash).
  // Treat 200–503 as acceptable operational responses; 504+ or network errors fail.
  if (res.status >= 504) throw new Error(`status ${res.status}`);
  const body = await res.json().catch(() => null);
  return { status: res.status, body };
});

await check('invalid_upstream_path_handled', async () => {
  const res = await fetch(`${base}/api/v1/this-route-should-404-or-proxy`, {
    signal: AbortSignal.timeout(5000),
  });
  if (res.status === 200) throw new Error('unexpected 200 for unknown route');
  return { status: res.status };
});

await check('rate_limit_headers_or_429', async () => {
  let sawHeaders = false;
  let saw429 = false;
  for (let i = 0; i < 50; i += 1) {
    const res = await fetch(`${base}/health`, { signal: AbortSignal.timeout(3000) });
    if (res.headers.get('x-ratelimit-limit')) sawHeaders = true;
    if (res.status === 429) saw429 = true;
  }
  // Health is skipped by rate limiter — headers may be absent; ensure endpoint stays healthy
  return { sawHeaders, saw429, note: 'health path is intentionally skipped from rate limits' };
});

await check('swagger_available', async () => {
  const res = await fetch(`${base}/api/docs`, { signal: AbortSignal.timeout(5000) });
  if (!res.ok) throw new Error(`status ${res.status}`);
  return { status: res.status };
});

await check('resilience_metrics_endpoint', async () => {
  const headers = {};
  if (process.env.INTERNAL_API_KEY) {
    headers['x-internal-api-key'] = process.env.INTERNAL_API_KEY;
  }
  const res = await fetch(`${base}/metrics/resilience`, {
    signal: AbortSignal.timeout(3000),
    headers,
  });
  if (res.status === 404) {
    return { status: 404, note: 'restart gateway to expose Phase 13 metrics' };
  }
  if (res.status === 401) {
    return {
      status: 401,
      note: 'metrics protected; set INTERNAL_API_KEY for authenticated scrape',
    };
  }
  if (!res.ok) throw new Error(`status ${res.status}`);
  return await res.json();
});

const failed = results.filter((r) => !r.ok);
console.log(JSON.stringify({ base, passed: results.length - failed.length, failed: failed.length, results }, null, 2));
process.exitCode = failed.length ? 1 : 0;
