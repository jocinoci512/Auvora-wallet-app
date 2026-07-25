/**
 * Copies .env.example to .env when .env is missing.
 * Run: node scripts/bootstrap.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const example = path.join(root, '.env.example');
const target = path.join(root, '.env');

if (!fs.existsSync(example)) {
  console.error('.env.example not found — cannot bootstrap environment');
  process.exit(1);
}

if (fs.existsSync(target)) {
  console.log('.env already exists — skipping copy');
  process.exit(0);
}

fs.copyFileSync(example, target);
console.log('Created .env from .env.example');
