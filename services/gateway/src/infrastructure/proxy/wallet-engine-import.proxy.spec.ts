import { WALLET_PROXY_PREFIXES } from './wallet-proxy.middleware';

describe('wallet proxy prefixes', () => {
  it('forwards public wallet-engine import to the wallet service', () => {
    expect(WALLET_PROXY_PREFIXES).toContain('/api/v1/wallet-engine');
    const importPath = '/api/v1/wallet-engine/wallets/import';
    const match = WALLET_PROXY_PREFIXES.some(
      (prefix) => importPath === prefix || importPath.startsWith(`${prefix}/`),
    );
    expect(match).toBe(true);
  });
});
