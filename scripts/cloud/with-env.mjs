/**
 * Runs a command with the repo-root `.env` loaded into the environment.
 *
 * Most Auvora services read configuration straight from `process.env` and do
 * not load `.env` themselves, so their `pnpm --filter ... dev` commands expect
 * the shell to already export those variables. This wrapper loads root `.env`
 * (a minimal, dependency-free parser that tolerates spaces and `=` in values)
 * and then execs the given command with the merged environment. Using it for
 * every service guarantees they share the same secrets (e.g. JWT_ACCESS_SECRET
 * must match between the auth issuer and the wallet/gateway verifiers).
 *
 * Usage: node scripts/cloud/with-env.mjs <command> [args...]
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const envPath = path.join(root, '.env');

function parseEnv(contents) {
  const result = {};
  for (const rawLine of contents.split('\n')) {
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

const fileEnv = fs.existsSync(envPath) ? parseEnv(fs.readFileSync(envPath, 'utf8')) : {};
// Real process env wins over file values, so inline overrides (e.g. PORT=4001) still work.
const merged = { ...fileEnv, ...process.env };

const [, , cmd, ...args] = process.argv;
if (!cmd) {
  console.error('usage: node scripts/cloud/with-env.mjs <command> [args...]');
  process.exit(1);
}

const child = spawn(cmd, args, { stdio: 'inherit', env: merged });
child.on('exit', (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  else process.exit(code ?? 0);
});
