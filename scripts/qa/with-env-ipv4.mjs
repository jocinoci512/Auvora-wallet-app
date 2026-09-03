/**
 * LOCAL QA — rewrite localhost -> 127.0.0.1 in DATABASE_URL/REDIS_URL for
 * Prisma engine IPv6 quirks on Windows, then exec the child command.
 * Does not print secrets. Does not modify .env on disk.
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
    if (!line || line.startsWith('#')) continue;
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

function preferIpv4(url) {
  if (!url) return url;
  return url
    .replace(/@localhost(?=[:/])/g, '@127.0.0.1')
    .replace(/:\/\/localhost(?=[:/])/g, '://127.0.0.1');
}

const fileEnv = fs.existsSync(envPath) ? parseEnv(fs.readFileSync(envPath, 'utf8')) : {};
const merged = { ...fileEnv, ...process.env };
merged.DATABASE_URL = preferIpv4(merged.DATABASE_URL);
merged.REDIS_URL = preferIpv4(merged.REDIS_URL);

const [, , cmd, ...args] = process.argv;
if (!cmd) {
  console.error('usage: node scripts/qa/with-env-ipv4.mjs <command> [args...]');
  process.exit(1);
}

console.log(
  '[with-env-ipv4] DATABASE_URL host rewritten for local Prisma (localhost->127.0.0.1 if needed)',
);

const child = spawn(cmd, args, {
  stdio: 'inherit',
  env: merged,
  shell: process.platform === 'win32',
});
child.on('exit', (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  else process.exit(code ?? 0);
});
child.on('error', (err) => {
  console.error(`[with-env-ipv4] failed to spawn ${cmd}: ${err.message}`);
  process.exit(1);
});
