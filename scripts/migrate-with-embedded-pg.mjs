/**
 * One-shot: start embedded Postgres, migrate, seed, then exit (leaves DB data on disk).
 * Redis is started separately via scripts/start-redis.mjs
 */
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const EmbeddedPostgres = require('embedded-postgres').default;

const dataDir = path.join(root, '.local-data', 'postgres');
fs.mkdirSync(dataDir, { recursive: true });

const postgres = new EmbeddedPostgres({
  databaseDir: dataDir,
  user: 'auvora',
  password: 'auvora',
  port: 5432,
  persistent: true,
});

const databaseUrl = 'postgresql://auvora:auvora@127.0.0.1:5432/auvora_wallet?schema=public';

async function main() {
  await postgres.initialise();
  await postgres.start();
  try {
    await postgres.createDatabase('auvora_wallet');
  } catch {
    // Database may already exist on subsequent runs.
  }

  const env = {
    ...process.env,
    DATABASE_URL: databaseUrl,
    PRISMA_GENERATE_SKIP_AUTOINSTALL: 'true',
    PATH: `${path.join(root, '.tools', 'pnpm')};${process.env.PATH ?? ''}`,
  };

  const migrate = spawnSync(
    path.join(root, '.tools', 'pnpm', 'pnpm.exe'),
    ['--filter', '@auvora/database-schema', 'exec', 'prisma', 'migrate', 'deploy'],
    { cwd: root, env, encoding: 'utf8', shell: false },
  );
  process.stdout.write(migrate.stdout ?? '');
  process.stderr.write(migrate.stderr ?? '');
  if (migrate.status !== 0) {
    throw new Error(`migrate deploy failed with code ${migrate.status}`);
  }

  const seed = spawnSync(
    path.join(root, '.tools', 'pnpm', 'pnpm.exe'),
    ['--filter', '@auvora/database-schema', 'seed'],
    { cwd: root, env, encoding: 'utf8', shell: false },
  );
  process.stdout.write(seed.stdout ?? '');
  process.stderr.write(seed.stderr ?? '');
  if (seed.status !== 0) {
    throw new Error(`seed failed with code ${seed.status}`);
  }

  process.stdout.write(
    JSON.stringify({ level: 'info', msg: 'migrate+seed complete; postgres still running', databaseUrl }) + '\n',
  );

  // Keep postgres alive until killed
  process.on('SIGINT', async () => {
    await postgres.stop();
    process.exit(0);
  });
  await new Promise(() => undefined);
}

main().catch(async (error) => {
  process.stderr.write(
    JSON.stringify({
      level: 'error',
      msg: error instanceof Error ? error.message : String(error),
    }) + '\n',
  );
  try {
    await postgres.stop();
  } catch {
    // ignore
  }
  process.exit(1);
});
