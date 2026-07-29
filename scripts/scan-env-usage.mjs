import fs from 'node:fs';
import path from 'node:path';

const roots = ['apps', 'services', 'packages', 'scripts', 'database'];
const skip = new Set(['node_modules', 'dist', '.next', 'coverage', '.turbo']);
const keys = new Set();
const by = {
  web: new Set(),
  admin: new Set(),
  docs: new Set(),
  services: new Set(),
  other: new Set(),
};
const re = /process\.env(?:\.|\[(?:'|"))([A-Z0-9_]+)/g;

function walk(dir, rel = '') {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const e of entries) {
    if (skip.has(e.name)) continue;
    const full = path.join(dir, e.name);
    const r = rel ? `${rel}/${e.name}` : e.name;
    if (e.isDirectory()) {
      walk(full, r);
      continue;
    }
    if (!/\.(ts|tsx|js|jsx|mjs|cjs)$/.test(e.name)) continue;
    const text = fs.readFileSync(full, 'utf8');
    for (const m of text.matchAll(re)) {
      const k = m[1];
      keys.add(k);
      if (r.startsWith('apps/web/')) by.web.add(k);
      else if (r.startsWith('apps/admin/')) by.admin.add(k);
      else if (r.startsWith('apps/docs/')) by.docs.add(k);
      else if (r.startsWith('services/')) by.services.add(k);
      else by.other.add(k);
    }
  }
}

for (const root of roots) walk(root, root);

const schemaKeys = new Set();
function walkSchema(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (skip.has(e.name)) continue;
      walkSchema(full);
      continue;
    }
    if (e.name !== 'env.schema.ts') continue;
    const text = fs.readFileSync(full, 'utf8');
    for (const m of text.matchAll(/^\s{2}([A-Z][A-Z0-9_]+):/gm)) {
      schemaKeys.add(m[1]);
    }
  }
}
walkSchema('services');

const example = fs.readFileSync('.env.example', 'utf8');
const exampleSet = new Set(
  [...example.matchAll(/^(?:#\s*)?([A-Z][A-Z0-9_]*)=/gm)].map((m) => m[1]),
);

fs.mkdirSync('.verify-logs', { recursive: true });
fs.writeFileSync('.verify-logs/process-env-keys.txt', [...keys].sort().join('\n'));
fs.writeFileSync('.verify-logs/schema-keys.txt', [...schemaKeys].sort().join('\n'));
fs.writeFileSync('.verify-logs/env-example-keys.txt', [...exampleSet].sort().join('\n'));

const out = {
  total: keys.size,
  web: [...by.web].sort(),
  admin: [...by.admin].sort(),
  docs: [...by.docs].sort(),
  servicesCount: by.services.size,
  services: [...by.services].sort(),
  other: [...by.other].sort(),
  schemaCount: schemaKeys.size,
  schema: [...schemaKeys].sort(),
  exampleCount: exampleSet.size,
};
fs.writeFileSync('.verify-logs/env-scan.json', JSON.stringify(out, null, 2));
console.log(JSON.stringify(out, null, 2));
