#!/usr/bin/env node
/**
 * Fail loudly if Docker build-context stubs referenced by Dockerfile.service
 * are missing from the repo (or would be excluded incorrectly).
 *
 * Usage (repo root): node infrastructure/docker/validate-service-context.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

const SERVICES = [
  'gateway',
  'auth',
  'wallet',
  'blockchain',
  'payments',
  'compliance',
  'notifications',
  'analytics',
  'ai',
  'custody',
  'observability',
  'market-data',
  'swap',
  'nft',
  'staking',
  'connections',
  'bridge',
];

const required = [
  'package.json',
  'pnpm-lock.yaml',
  'pnpm-workspace.yaml',
  'turbo.json',
  'tsconfig.base.json',
  'packages',
  'database/package.json',
  'database/prisma/schema.prisma',
  'scripts',
  'apps/admin/package.json',
  'apps/docs/package.json',
  'apps/web/package.json',
  'infrastructure/docker/Dockerfile.service',
  'Dockerfile',
  '.dockerignore',
  'railway.toml',
  ...SERVICES.map((s) => `services/${s}/package.json`),
];

const missing = required.filter((rel) => !fs.existsSync(path.join(root, rel)));

const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const enginesNode = pkg.engines?.node ?? '';
const packageManager = pkg.packageManager ?? '';

const problems = [];

if (missing.length) {
  problems.push(`Missing paths:\n  - ${missing.join('\n  - ')}`);
}

if (!String(enginesNode).includes('22')) {
  problems.push(`engines.node (${enginesNode}) should allow Node 22 (Docker uses node:22-alpine)`);
}

if (!String(packageManager).startsWith('pnpm@9.')) {
  problems.push(
    `packageManager (${packageManager}) should be pnpm@9.x to match Corepack in Docker`,
  );
}

for (const name of SERVICES) {
  const pjPath = path.join(root, 'services', name, 'package.json');
  if (!fs.existsSync(pjPath)) continue;
  const pj = JSON.parse(fs.readFileSync(pjPath, 'utf8'));
  const expected = `@auvora/${name}-service`;
  if (pj.name !== expected) {
    problems.push(
      `services/${name} package name is "${pj.name}", expected "${expected}" (turbo filter)`,
    );
  }
}

const dockerfiles = [
  fs.readFileSync(path.join(root, 'infrastructure/docker/Dockerfile.service'), 'utf8'),
  fs.readFileSync(path.join(root, 'Dockerfile'), 'utf8'),
];
for (const [i, content] of dockerfiles.entries()) {
  const label = i === 0 ? 'Dockerfile.service' : 'root Dockerfile';
  if (/ARG SERVICE=gateway/.test(content)) {
    problems.push(`${label} still defaults SERVICE=gateway (must require explicit SERVICE)`);
  }
  if (!content.includes('pnpm --filter="@auvora/${SERVICE}-service" deploy --prod')) {
    problems.push(`${label} must use pnpm deploy --prod for portable node_modules`);
  }
  if (!content.includes('ENV CI=true')) {
    problems.push(`${label} should set CI=true to skip husky prepare`);
  }
}

if (problems.length) {
  console.error('Dockerfile service context validation FAILED\n');
  for (const p of problems) console.error(`- ${p}`);
  process.exit(1);
}

console.log(
  JSON.stringify(
    {
      level: 'info',
      msg: 'Dockerfile service context OK',
      services: SERVICES.length,
      packageManager,
      enginesNode,
    },
    null,
    2,
  ),
);
