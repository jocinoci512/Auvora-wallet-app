#!/usr/bin/env node
/**
 * Staging operational validation harness (Task 038).
 * Runs live Alchemy RPC probe, gateway chaos checks, resilience sim,
 * and journey smoke — soft-skips pieces that need mesh/Postgres.
 *
 * Usage: node scripts/staging-validate.mjs
 * Env: API_URL (default http://localhost:4000), WEB_URL (default http://localhost:3000)
 */
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

const root = process.cwd();
const api = (process.env.API_URL || 'http://localhost:4000').replace(/\/$/, '');
const report = {
  generatedAt: new Date().toISOString(),
  api,
  steps: [],
};

function run(name, args, opts = {}) {
  const started = Date.now();
  const result = spawnSync(process.execPath, args, {
    cwd: root,
    encoding: 'utf8',
    env: { ...process.env, API_URL: api, ...(opts.env || {}) },
  });
  const ok = result.status === 0;
  let parsed = null;
  try {
    parsed = JSON.parse((result.stdout || '').trim().split('\n').filter(Boolean).at(-1) || 'null');
  } catch {
    parsed = null;
  }
  const step = {
    name,
    ok,
    ms: Date.now() - started,
    status: result.status,
    stderr: (result.stderr || '').trim().slice(0, 500) || undefined,
    stdoutTail: (result.stdout || '').trim().slice(-800) || undefined,
    parsed,
  };
  report.steps.push(step);
  console.error(`${ok ? 'PASS' : 'FAIL'} ${name} (${step.ms}ms)`);
  return step;
}

run('alchemy_rpc', [resolve(root, 'scripts/verify-alchemy-rpc.mjs')]);
run('resilience_sim', [resolve(root, 'scripts/perf/resilience-sim.mjs')]);
run('chaos_gateway', [resolve(root, 'scripts/perf/chaos-test.mjs'), '--base', api]);
run('journey_smoke', [resolve(root, 'scripts/perf/journey-smoke.mjs')], {
  env: { API_URL: api, WEB_URL: process.env.WEB_URL || 'http://localhost:3000' },
});

const failed = report.steps.filter((s) => !s.ok);
report.summary = {
  passed: report.steps.filter((s) => s.ok).length,
  failed: failed.length,
  total: report.steps.length,
  productionRecommendation:
    failed.length === 0
      ? 'staging_validation_green_continue_soak'
      : failed.some((s) => s.name === 'alchemy_rpc')
        ? 'fix_alchemy_or_keys_before_live_chain_staging'
        : 'investigate_failed_steps_then_re_run',
};

console.log(JSON.stringify(report, null, 2));
process.exitCode = failed.length === 0 ? 0 : 1;
