import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  ALL_MARKET_DATA_PERMISSION_CODES,
  PERMISSION_MARKET_DATA_ADMIN,
  PERMISSION_MARKET_DATA_ALERTS,
  PERMISSION_MARKET_DATA_READ,
  PERMISSION_MARKET_DATA_WRITE,
} from './permission-codes';

/**
 * Guard: every market-data permission the controllers enforce must exist in the
 * database seed catalog, and the user-facing ones must be granted to the default
 * user role. Otherwise authenticated market-data reads 403 for everyone through
 * the gateway (regression that previously shipped market-data with no seeded
 * permission at all).
 */
describe('market-data permissions are seeded', () => {
  const seed = readFileSync(resolve(__dirname, '../../../../database/seed/index.ts'), 'utf8');
  // The PERMISSIONS catalog is the top array of `{ code: '...' }` entries.
  const catalogCodes = new Set([...seed.matchAll(/code:\s*'([^']+)'/g)].map((m) => m[1]));
  // USER_WALLET_PERMISSION_CODES holds the default-user grants.
  const userBlock = seed.slice(
    seed.indexOf('USER_WALLET_PERMISSION_CODES'),
    seed.indexOf('] as const', seed.indexOf('USER_WALLET_PERMISSION_CODES')),
  );

  it('catalog includes every market-data permission code', () => {
    for (const code of ALL_MARKET_DATA_PERMISSION_CODES) {
      expect(catalogCodes.has(code)).toBe(true);
    }
  });

  it('default user role is granted market-data read/write/alerts', () => {
    for (const code of [
      PERMISSION_MARKET_DATA_READ,
      PERMISSION_MARKET_DATA_WRITE,
      PERMISSION_MARKET_DATA_ALERTS,
    ]) {
      expect(userBlock.includes(`'${code}'`)).toBe(true);
    }
  });

  it('market-data:admin exists in the catalog (admin-only, not a default user grant)', () => {
    expect(catalogCodes.has(PERMISSION_MARKET_DATA_ADMIN)).toBe(true);
    expect(userBlock.includes(`'${PERMISSION_MARKET_DATA_ADMIN}'`)).toBe(false);
  });
});
