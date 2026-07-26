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
}

console.log(JSON.stringify({ base, generatedAt: new Date().toISOString(), reports }, null, 2));
