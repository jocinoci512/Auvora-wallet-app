/**
 * Cloud Agent one-shot database setup.
 *
 * Starts embedded Postgres, applies migrations (`prisma migrate deploy`) and
 * runs the idempotent seed, then stops Postgres so the on-disk data directory
 * is left consistent for a snapshot. Safe to run repeatedly.
 *
 * Usage: node scripts/cloud/db-setup.mjs
 */
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const EmbeddedPostgres = require('embedded-postgres').default;

const DATABASE_URL = 'postgresql://auvora:auvora@127.0.0.1:5432/auvora_wallet?schema=public';
const dataDir = path.join(root, '.local-data', 'postgres');
fs.mkdirSync(dataDir, { recursive: true });

const log = (obj) => process.stdout.write(JSON.stringify(obj) + '\n');

// Load root `.env` so the seed picks up SEED_ADMIN_* (and any other config).
function loadDotEnv() {
  const envPath = path.join(root, '.env');
  if (!fs.existsSync(envPath)) return {};
  const result = {};
  for (const rawLine of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const line = rawLine.trim();
    if (line === '' || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    result[key] = value;
  }
  return result;
}

const dotEnv = loadDotEnv();

const postgres = new EmbeddedPostgres({
  databaseDir: dataDir,
  user: 'auvora',
  password: 'auvora',
  port: 5432,
  persistent: true,
});

function run(cmd, args, cwd) {
  log({ level: 'info', msg: `run: ${cmd} ${args.join(' ')}` });
  const result = spawnSync(cmd, args, {
    cwd,
    // Precedence: root .env < real process env < forced DATABASE_URL to the embedded instance.
    env: { ...dotEnv, ...process.env, DATABASE_URL },
    stdio: 'inherit',
  });
  if (result.status !== 0) {
    throw new Error(`${cmd} ${args.join(' ')} exited with ${result.status}`);
  }
}

async function main() {
  const alreadyInitialized = fs.existsSync(path.join(dataDir, 'PG_VERSION'));
  if (!alreadyInitialized) {
    log({ level: 'info', msg: 'initialising embedded postgres cluster' });
    await postgres.initialise();
  }
  await postgres.start();
  try {
    await postgres.createDatabase('auvora_wallet');
  } catch {
    // already exists
  }

  try {
    run(
      'pnpm',
      ['--filter', '@auvora/database-schema', 'exec', 'prisma', 'migrate', 'deploy'],
      root,
    );
    run('pnpm', ['--filter', '@auvora/database-schema', 'run', 'seed'], root);
  } finally {
    await postgres.stop();
  }

  log({ level: 'info', msg: 'database setup complete' });
}

main().catch((error) => {
  log({
    level: 'error',
    msg: 'database setup failed',
    error: error instanceof Error ? error.message : String(error),
  });
  process.exit(1);
});
