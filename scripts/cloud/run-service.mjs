/**
 * Starts an Auvora service (or app) for local development after waiting for its
 * dependencies to be reachable, with the repo-root `.env` loaded.
 *
 * Intended for use as a persistent terminal command. Waiting keeps service
 * terminals from crash-looping when they boot slightly before the data plane.
 *
 * Usage:
 *   node scripts/cloud/run-service.mjs <pnpm-filter> <port> [--wait=host:port,...]
 *
 * Example:
 *   node scripts/cloud/run-service.mjs @auvora/auth-service 4001 --wait=127.0.0.1:5432,127.0.0.1:6379
 */
import { spawn } from 'node:child_process';
import net from 'node:net';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

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

function checkPort(host, port, timeoutMs = 1000) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    const done = (ok) => {
      socket.destroy();
      resolve(ok);
    };
    socket.setTimeout(timeoutMs);
    socket.once('connect', () => done(true));
    socket.once('timeout', () => done(false));
    socket.once('error', () => done(false));
    socket.connect(port, host);
  });
}

async function waitFor(target, { attempts = 120, delayMs = 1000 } = {}) {
  const [host, portStr] = target.split(':');
  const port = Number(portStr);
  for (let i = 0; i < attempts; i += 1) {
    if (await checkPort(host, port)) {
      console.log(`[run-service] dependency ready: ${target}`);
      return;
    }
    await new Promise((r) => setTimeout(r, delayMs));
  }
  throw new Error(`timed out waiting for ${target}`);
}

async function main() {
  const args = process.argv.slice(2);
  const filter = args[0];
  const port = args[1];
  const waitArg = args.find((a) => a.startsWith('--wait='));
  if (!filter || !port) {
    console.error(
      'usage: node scripts/cloud/run-service.mjs <pnpm-filter> <port> [--wait=host:port,...]',
    );
    process.exit(1);
  }

  const waitTargets = waitArg ? waitArg.slice('--wait='.length).split(',').filter(Boolean) : [];
  for (const target of waitTargets) {
    await waitFor(target);
  }

  const envPath = path.join(root, '.env');
  const fileEnv = fs.existsSync(envPath) ? parseEnv(fs.readFileSync(envPath, 'utf8')) : {};
  const env = { ...fileEnv, ...process.env, PORT: String(port) };

  console.log(`[run-service] starting ${filter} on port ${port}`);
  const child = spawn('pnpm', ['--filter', filter, 'dev'], {
    cwd: root,
    env,
    stdio: 'inherit',
  });
  child.on('exit', (code, signal) => {
    if (signal) process.kill(process.pid, signal);
    else process.exit(code ?? 0);
  });
}

main().catch((error) => {
  console.error(`[run-service] ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
