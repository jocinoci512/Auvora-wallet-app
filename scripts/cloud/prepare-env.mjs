/**
 * Cloud Agent env bootstrap.
 *
 * Creates `.env` from `.env.example` when missing, then fills any placeholder
 * secret values with strong, locally-generated random secrets. Idempotent:
 * real secrets that are already present are left untouched, so re-running never
 * rotates working credentials.
 *
 * Usage: node scripts/cloud/prepare-env.mjs
 */
import { randomBytes } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const example = path.join(root, '.env.example');
const target = path.join(root, '.env');

if (!fs.existsSync(example)) {
  console.error('.env.example not found — cannot prepare environment');
  process.exit(1);
}

if (!fs.existsSync(target)) {
  fs.copyFileSync(example, target);
  console.log('Created .env from .env.example');
} else {
  console.log('.env already exists — filling any placeholder secrets');
}

const base64 = (bytes) => randomBytes(bytes).toString('base64');
const hex = (bytes) => randomBytes(bytes).toString('hex');

// key -> generator for its replacement value
const SECRET_GENERATORS = {
  JWT_ACCESS_SECRET: () => base64(48),
  JWT_REFRESH_SECRET: () => base64(48),
  CSRF_SECRET: () => base64(32),
  INTERNAL_API_KEY: () => hex(32),
};

// Every *_FIELD_ENCRYPTION_KEY expects 32 bytes of hex.
const FIELD_KEY_SUFFIX = '_FIELD_ENCRYPTION_KEY';

const isPlaceholder = (value) => {
  const v = value.trim();
  if (v === '') return true;
  if (v.includes('<') || v.includes('>')) return true;
  if (v.startsWith('change-me')) return true;
  return false;
};

const lines = fs.readFileSync(target, 'utf8').split('\n');
const filled = [];

const out = lines.map((line) => {
  const match = /^([A-Z0-9_]+)=(.*)$/.exec(line);
  if (!match) return line;
  const [, key, value] = match;

  let generator = SECRET_GENERATORS[key];
  if (!generator && key.endsWith(FIELD_KEY_SUFFIX)) {
    generator = () => hex(32);
  }
  if (!generator) return line;

  if (isPlaceholder(value)) {
    filled.push(key);
    return `${key}=${generator()}`;
  }
  return line;
});

fs.writeFileSync(target, out.join('\n'));

// Restrict the dev secrets file to the owner where the OS supports it.
try {
  fs.chmodSync(target, 0o600);
} catch {
  /* non-POSIX filesystem — best effort */
}

if (filled.length > 0) {
  console.log(`Filled ${filled.length} placeholder secret(s): ${filled.join(', ')}`);
} else {
  console.log('No placeholder secrets to fill');
}
