import { spawnSync } from 'node:child_process';
import { existsSync, rmSync } from 'node:fs';
import path from 'node:path';

/**
 * Forces NODE_ENV=production for Next.js builds.
 * Always clears `.next` before production build so a prior `next dev` cache
 * cannot corrupt prerender output (and so subsequent `preview:ui` auto-clean
 * can detect a clean BUILD_ID-only tree).
 * Set NEXT_FORCE_CLEAN=0 to skip the wipe when intentionally reusing cache.
 */
const cwd = process.cwd();
const nextDir = path.join(cwd, '.next');
const env = { ...process.env, NODE_ENV: 'production' };
const forceClean = process.env.NEXT_FORCE_CLEAN !== '0';

if (existsSync(nextDir) && forceClean) {
  rmSync(nextDir, { recursive: true, force: true });
}

const result = spawnSync('npx', ['next', 'build'], {
  cwd,
  env,
  stdio: 'inherit',
  shell: true,
});

process.exit(result.status ?? 1);
