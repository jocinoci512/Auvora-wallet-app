/**
 * Isolated embedded Postgres + Redis for Admin security E2E.
 * Creates database `auvora_e2e` only. Does not touch production.
 */
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const EmbeddedPostgres = require('embedded-postgres').default;
const { RedisMemoryServer } = require('redis-memory-server');

const dataDir = path.join(root, '.local-data', 'e2e-postgres');
fs.mkdirSync(dataDir, { recursive: true });

const postgres = new EmbeddedPostgres({
  databaseDir: dataDir,
  user: 'auvora',
  password: 'auvora',
  port: 54329,
  persistent: true,
});

const redis = new RedisMemoryServer({ instance: { port: 63799 } });

async function main() {
  process.stdout.write(
    JSON.stringify({ level: 'info', msg: 'starting e2e embedded postgres' }) + '\n',
  );
  const alreadyInitialized = fs.existsSync(path.join(dataDir, 'PG_VERSION'));
  if (!alreadyInitialized) {
    await postgres.initialise();
  }
  await postgres.start();
  for (const name of ['auvora_e2e']) {
    try {
      await postgres.createDatabase(name);
    } catch {
      // already exists
    }
  }

  const redisPort = await redis.getPort();
  const redisHost = await redis.getHost();
  process.stdout.write(
    JSON.stringify({
      level: 'info',
      msg: 'e2e data plane ready',
      databaseUrl: 'postgresql://auvora:auvora@127.0.0.1:54329/auvora_e2e?schema=public',
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
  await new Promise(() => undefined);
}

main().catch((error) => {
  process.stderr.write(
    JSON.stringify({
      level: 'error',
      msg: 'failed to start e2e data plane',
      error: error instanceof Error ? error.message : String(error),
    }) + '\n',
  );
  process.exit(1);
});
