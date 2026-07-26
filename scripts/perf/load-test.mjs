#!/usr/bin/env node
/**
 * Lightweight HTTP load harness (no k6 required).
 * Usage:
 *   node scripts/perf/load-test.mjs --base http://localhost:4000 --path /health --concurrency 20 --duration 10
 */
import { performance } from 'node:perf_hooks';

function arg(name, fallback) {
  const idx = process.argv.indexOf(`--${name}`);
  if (idx === -1) return fallback;
  return process.argv[idx + 1] ?? fallback;
}

const base = arg('base', 'http://localhost:4000').replace(/\/$/, '');
const path = arg('path', '/health');
const concurrency = Number(arg('concurrency', '20'));
const durationSec = Number(arg('duration', '10'));
const method = arg('method', 'GET').toUpperCase();
const url = `${base}${path.startsWith('/') ? path : `/${path}`}`;

const latencies = [];
let ok = 0;
let errors = 0;
let inFlight = 0;
let stopped = false;

async function oneRequest() {
  const start = performance.now();
  try {
    const res = await fetch(url, { method, signal: AbortSignal.timeout(10_000) });
    const ms = performance.now() - start;
    latencies.push(ms);
    if (res.ok) ok += 1;
    else errors += 1;
  } catch {
    latencies.push(performance.now() - start);
    errors += 1;
  }
}

async function worker() {
  while (!stopped) {
    inFlight += 1;
    await oneRequest();
    inFlight -= 1;
  }
}

function percentile(sorted, p) {
  if (sorted.length === 0) return 0;
  const idx = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return sorted[idx];
}

const started = Date.now();
const workers = Array.from({ length: concurrency }, () => worker());
await new Promise((r) => setTimeout(r, durationSec * 1000));
stopped = true;
await Promise.all(workers);

const elapsed = (Date.now() - started) / 1000;
const sorted = [...latencies].sort((a, b) => a - b);
const total = ok + errors;
const report = {
  url,
  method,
  concurrency,
  durationSec,
  totalRequests: total,
  ok,
  errors,
  errorRate: total === 0 ? 0 : errors / total,
  rps: total / elapsed,
  latencyMs: {
    p50: Number(percentile(sorted, 50).toFixed(2)),
    p95: Number(percentile(sorted, 95).toFixed(2)),
    p99: Number(percentile(sorted, 99).toFixed(2)),
    max: Number((sorted[sorted.length - 1] ?? 0).toFixed(2)),
  },
};

console.log(JSON.stringify(report, null, 2));
if (errors / Math.max(1, total) > 0.05) {
  process.exitCode = 2;
}
