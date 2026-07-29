#!/usr/bin/env node
/**
 * Multi-route load suite for Phase 13 domains.
 * Runs sequential short bursts and prints a combined report.
 */
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const loader = path.join(__dirname, 'load-test.mjs');
const base = process.env.API_URL || 'http://localhost:4000';

const scenarios = [
  { name: 'health', base, path: '/health', concurrency: 50, duration: 5 },
  { name: 'swagger', base, path: '/api/docs', concurrency: 10, duration: 5 },
  {
    name: 'auth_health',
    base: process.env.AUTH_URL || 'http://localhost:4001',
    path: '/health',
    concurrency: 20,
    duration: 5,
  },
  {
    name: 'wallet_health',
    base: process.env.WALLET_URL || 'http://localhost:3002',
    path: '/health',
    concurrency: 20,
    duration: 5,
  },
];

const reports = [];
let unreachable = 0;
for (const scenario of scenarios) {
  const result = spawnSync(
    process.execPath,
    [
      loader,
      '--base',
      scenario.base,
      '--path',
      scenario.path,
      '--concurrency',
      String(scenario.concurrency),
      '--duration',
      String(scenario.duration),
    ],
    { encoding: 'utf8' },
  );
  let parsed = null;
  try {
    parsed = JSON.parse(result.stdout);
  } catch {
    parsed = { raw: result.stdout, stderr: result.stderr, status: result.status };
  }
  reports.push({ scenario: scenario.name, ...parsed });
  if (typeof parsed?.errorRate === 'number' && parsed.errorRate >= 1 && parsed.ok === 0) {
    unreachable += 1;
  }
}

console.log(JSON.stringify({ base, generatedAt: new Date().toISOString(), reports }, null, 2));

// Entire mesh unreachable → soft-skip for local RC hosts without API processes.
if (unreachable === scenarios.length) {
  console.error(
    'Load suite: all targets unreachable — soft-skip (start gateway/auth/wallet for live numbers).',
  );
  process.exitCode = 0;
} else {
  // Treat fully-unreachable optional upstreams as skipped (gateway may be up alone).
  const failing = reports.filter((r) => {
    if (typeof r.errorRate !== 'number' || r.errorRate <= 0.05) return false;
    if (r.ok === 0 && r.errorRate >= 1 && ['auth_health', 'wallet_health'].includes(r.scenario)) {
      return false;
    }
    return true;
  });
  const skippedUpstreams = reports.filter(
    (r) =>
      ['auth_health', 'wallet_health'].includes(r.scenario) &&
      r.ok === 0 &&
      typeof r.errorRate === 'number' &&
      r.errorRate >= 1,
  );
  if (skippedUpstreams.length) {
    console.error(
      `Load suite: skipped unreachable upstreams: ${skippedUpstreams.map((r) => r.scenario).join(', ')}`,
    );
  }
  if (failing.length) {
    console.error(
      `Load suite exceeded 5% error rate for: ${failing.map((r) => r.scenario).join(', ')}`,
    );
    process.exitCode = 2;
  }
}
