import { spawnSync } from 'node:child_process';
import { existsSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';

/**
 * Forces NODE_ENV=production for Next.js builds.
 * Always clears `.next` before production build so a prior `next dev` cache
 * cannot corrupt prerender output (and so subsequent `preview:ui` auto-clean
 * can detect a clean BUILD_ID-only tree).
 * Set NEXT_FORCE_CLEAN=0 to skip the wipe when intentionally reusing cache.
 *
 * Resolves the local `next` CLI via Node module resolution (no network `npx`)
 * so Vercel / pnpm monorepo installs stay offline-reliable.
 */
const cwd = process.cwd();
const nextDir = path.join(cwd, '.next');
const env = { ...process.env, NODE_ENV: 'production' };
const forceClean = process.env.NEXT_FORCE_CLEAN !== '0';

if (existsSync(nextDir) && forceClean) {
  rmSync(nextDir, { recursive: true, force: true });
}

const requireFromApp = createRequire(path.join(cwd, 'package.json'));
let nextCli;
try {
  nextCli = requireFromApp.resolve('next/dist/bin/next');
} catch {
  console.error('Unable to resolve next/dist/bin/next from', cwd);
  process.exit(1);
}

const result = spawnSync(process.execPath, [nextCli, 'build'], {
  cwd,
  env,
  stdio: 'inherit',
});

process.exit(result.status ?? 1);
