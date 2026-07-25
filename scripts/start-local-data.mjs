/**
 * Starts embedded Postgres + in-memory Redis for local Phase 2 verification.
 * Usage: node scripts/start-local-data.mjs
 */
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const EmbeddedPostgres = require('embedded-postgres').default;
const { RedisMemoryServer } = require('redis-memory-server');

const dataDir = path.join(root, '.local-data', 'postgres');
fs.mkdirSync(dataDir, { recursive: true });

const postgres = new EmbeddedPostgres({
  databaseDir: dataDir,
  user: 'auvora',
  password: 'auvora',
  port: 5432,
  persistent: true,
});

const redis = new RedisMemoryServer({ instance: { port: 6379 } });

async function main() {
  process.stdout.write(JSON.stringify({ level: 'info', msg: 'starting embedded postgres' }) + '\n');
  await postgres.initialise();
  await postgres.start();
  await postgres.createDatabase('auvora_wallet');

  process.stdout.write(JSON.stringify({ level: 'info', msg: 'starting redis-memory-server' }) + '\n');
  const redisPort = await redis.getPort();
  const redisHost = await redis.getHost();

  process.stdout.write(
    JSON.stringify({
      level: 'info',
      msg: 'local data plane ready',
      databaseUrl: 'postgresql://auvora:auvora@127.0.0.1:5432/auvora_wallet?schema=public',
      redisUrl: `redis://${redisHost}:${redisPort}`,
    }) + '\n',
  );

  const shutdown = async () => {
    await redis.stop();
    await postgres.stop();
    process.exit(0);
  };
  process.on('SIGINT', () => void shutdown());
  process.on('SIGTERM', () => void shutdown());

  // Keep process alive
  await new Promise(() => undefined);
}

main().catch((error) => {
  process.stderr.write(
    JSON.stringify({
      level: 'error',
      msg: 'failed to start local data plane',
      error: error instanceof Error ? error.message : String(error),
    }) + '\n',
  );
  process.exit(1);
});
