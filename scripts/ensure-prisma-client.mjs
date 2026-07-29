import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const clientDir = path.join(root, 'database', 'generated', 'client');
const clientEntry = path.join(clientDir, 'index.js');
const engine = path.join(clientDir, 'query_engine-windows.dll.node');
const schema = path.join(root, 'database', 'prisma', 'schema.prisma');
const stamp = path.join(clientDir, '.schema-hash');

function sha256(content) {
  return createHash('sha256').update(content).digest('hex');
}

function schemaHash() {
  return sha256(fs.readFileSync(schema));
}

function clientHash() {
  return sha256(fs.readFileSync(clientEntry));
}

function readStamp() {
  if (!fs.existsSync(stamp)) return null;
  const raw = fs.readFileSync(stamp, 'utf8').trim();
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.schema === 'string' && typeof parsed.client === 'string') {
      return parsed;
    }
  } catch {
    // legacy single-hash stamp
  }
  return null;
}

function needsGenerate() {
  if (!fs.existsSync(clientEntry) || !fs.existsSync(engine) || !fs.existsSync(schema)) {
    return true;
  }
  const current = readStamp();
  if (!current) return true;
  return current.schema !== schemaHash() || current.client !== clientHash();
}

if (!needsGenerate()) {
  process.stdout.write(
    JSON.stringify({ level: 'info', msg: 'prisma client up to date; skipping generate' }) + '\n',
  );
  process.exit(0);
}

const result = spawnSync(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['prisma', 'generate'], {
  cwd: path.join(root, 'database'),
  env: { ...process.env, PRISMA_GENERATE_SKIP_AUTOINSTALL: 'true' },
  encoding: 'utf8',
  shell: true,
});
process.stdout.write(result.stdout ?? '');
process.stderr.write(result.stderr ?? '');
if ((result.status ?? 1) === 0) {
  fs.mkdirSync(clientDir, { recursive: true });
  fs.writeFileSync(stamp, JSON.stringify({ schema: schemaHash(), client: clientHash() }));
}
process.exit(result.status ?? 1);
