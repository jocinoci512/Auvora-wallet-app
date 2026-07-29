import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Load monorepo root `.env` into process.env without adding a dotenv dependency.
 * Existing process env values win (do not override).
 * Never logs secret values.
 */
export function loadRootEnvFile(startDir: string = process.cwd()): string | null {
  const candidates = [
    resolve(startDir, '.env'),
    resolve(startDir, '..', '.env'),
    resolve(startDir, '..', '..', '.env'),
    resolve(startDir, '..', '..', '..', '.env'),
  ];

  const envPath = candidates.find((p) => existsSync(p)) ?? null;
  if (!envPath) {
    return null;
  }

  const content = readFileSync(envPath, 'utf8');
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const idx = line.indexOf('=');
    if (idx < 1) continue;
    const key = line.slice(0, idx).trim();
    let value = line.slice(idx + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
  return envPath;
}
