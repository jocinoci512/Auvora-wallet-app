import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const clientEntry = path.join(root, 'database', 'generated', 'client', 'index.js');
const engine = path.join(root, 'database', 'generated', 'client', 'query_engine-windows.dll.node');

if (fs.existsSync(clientEntry) && fs.existsSync(engine)) {
  process.stdout.write(
    JSON.stringify({ level: 'info', msg: 'prisma client already present; skipping generate' }) + '\n',
  );
  process.exit(0);
}

const result = spawnSync(
  process.platform === 'win32' ? 'npx.cmd' : 'npx',
  ['prisma', 'generate'],
  {
    cwd: path.join(root, 'database'),
    env: { ...process.env, PRISMA_GENERATE_SKIP_AUTOINSTALL: 'true' },
    encoding: 'utf8',
    shell: true,
  },
);
process.stdout.write(result.stdout ?? '');
process.stderr.write(result.stderr ?? '');
process.exit(result.status ?? 1);
