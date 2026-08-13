/**
 * Cloud Agent local data plane: embedded Postgres + system Redis.
 *
 * Unlike scripts/start-local-data.mjs (which uses redis-memory-server, and
 * compiles Redis from source), this variant runs the system `redis-server`
 * binary. That avoids the jemalloc LTO link failure seen when building Redis
 * from source on the Cloud Agent base image, while keeping the same embedded
 * Postgres used by the no-Docker local flow.
 *
 * Long-running: keeps Postgres and Redis alive until interrupted. Intended to
 * be run as a persistent terminal / start service.
 *
 * Usage: node scripts/cloud/data-plane.mjs
 */
import { spawn, spawnSync } from 'node:child_process';
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

// Load root `.env` so a boot-time seed picks up SEED_ADMIN_* etc.
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

const childEnv = { ...loadDotEnv(), ...process.env, DATABASE_URL };

function ensureSchema() {
  // Idempotent: `migrate deploy` is a no-op when already current and the seed
  // upserts, so this is safe to run on every boot and self-heals a DB whose
  // on-disk data was not carried over from the snapshot.
  log({ level: 'info', msg: 'applying migrations (prisma migrate deploy)' });
  const migrate = spawnSync(
    'pnpm',
    ['--filter', '@auvora/database-schema', 'exec', 'prisma', 'migrate', 'deploy'],
    { cwd: root, env: childEnv, stdio: 'inherit' },
  );
  if (migrate.status !== 0) throw new Error(`migrate deploy failed (${migrate.status})`);

  log({ level: 'info', msg: 'seeding database (idempotent)' });
  const seed = spawnSync('pnpm', ['--filter', '@auvora/database-schema', 'run', 'seed'], {
    cwd: root,
    env: childEnv,
    stdio: 'inherit',
  });
  if (seed.status !== 0) throw new Error(`seed failed (${seed.status})`);
}

const postgres = new EmbeddedPostgres({
  databaseDir: dataDir,
  user: 'auvora',
  password: 'auvora',
  port: 5432,
  persistent: true,
});

let redis;

async function startRedis() {
  return new Promise((resolve, reject) => {
    // Bind to loopback only (never publicly reachable), and keep it in-memory
    // only (--save "" / --appendonly no) for an ephemeral dev data plane.
    redis = spawn(
      'redis-server',
      [
        '--port',
        '6379',
        '--bind',
        '127.0.0.1',
        '--save',
        '',
        '--appendonly',
        'no',
        '--loglevel',
        'warning',
      ],
      { stdio: ['ignore', 'inherit', 'inherit'] },
    );
    redis.on('error', reject);
    // Give redis a brief moment to bind the port.
    setTimeout(resolve, 500);
  });
}

async function main() {
  log({ level: 'info', msg: 'starting embedded postgres' });
  const alreadyInitialized = fs.existsSync(path.join(dataDir, 'PG_VERSION'));
  if (!alreadyInitialized) {
    await postgres.initialise();
  }
  await postgres.start();
  try {
    await postgres.createDatabase('auvora_wallet');
  } catch {
    // Database already exists on subsequent runs.
  }

  log({ level: 'info', msg: 'starting system redis-server' });
  await startRedis();

  ensureSchema();

  log({
    level: 'info',
    msg: 'local data plane ready',
    databaseUrl: 'postgresql://auvora:auvora@127.0.0.1:5432/auvora_wallet?schema=public',
    redisUrl: 'redis://127.0.0.1:6379',
  });

  const shutdown = async () => {
    try {
      if (redis) redis.kill('SIGTERM');
    } catch {
      /* ignore */
    }
    try {
      await postgres.stop();
    } catch {
      /* ignore */
    }
    process.exit(0);
  };
  process.on('SIGINT', () => void shutdown());
  process.on('SIGTERM', () => void shutdown());

  // Keep the process alive.
  await new Promise(() => undefined);
}

main().catch((error) => {
  log({
    level: 'error',
    msg: 'failed to start local data plane',
    error: error instanceof Error ? error.message : String(error),
  });
  process.exit(1);
});
