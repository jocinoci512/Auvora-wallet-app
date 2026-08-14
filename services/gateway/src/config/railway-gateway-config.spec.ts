import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Guard: the gateway-prod config-as-code upstream guidance must reference the
 * production Railway services. Legacy unsuffixed names (wallet, blockchain,
 * market-data, connections) do not resolve in the prod project and would fall
 * back to localhost, silently breaking those upstreams.
 */
describe('railway.gateway.toml upstream service references', () => {
  const toml = readFileSync(resolve(__dirname, '../../../../railway.gateway.toml'), 'utf8');

  it('documents production (-prod) upstream service references', () => {
    expect(toml).toContain('${{auth-prods.RAILWAY_PRIVATE_DOMAIN}}:4001');
    expect(toml).toContain('${{wallet-prod.RAILWAY_PRIVATE_DOMAIN}}:3002');
    expect(toml).toContain('${{blockchain-prod.RAILWAY_PRIVATE_DOMAIN}}:3003');
    expect(toml).toContain('"market-data-prod".RAILWAY_PRIVATE_DOMAIN');
    expect(toml).toContain('${{connections-prod.RAILWAY_PRIVATE_DOMAIN}}:3016');
  });

  it('does not reference legacy unsuffixed upstream service names', () => {
    expect(toml).not.toMatch(/\$\{\{\s*wallet\.RAILWAY_PRIVATE_DOMAIN/);
    expect(toml).not.toMatch(/\$\{\{\s*blockchain\.RAILWAY_PRIVATE_DOMAIN/);
    expect(toml).not.toMatch(/"market-data"\.RAILWAY_PRIVATE_DOMAIN/);
    expect(toml).not.toMatch(/\$\{\{\s*connections\.RAILWAY_PRIVATE_DOMAIN/);
  });
});
