import {
  containsSecretMaterial,
  stripSecretFields,
  toSafeConnectionView,
} from './sanitize-session';

describe('connection sanitization', () => {
  it('drops WalletConnect secrets before UI mapping', () => {
    const raw = {
      id: 'sess-1',
      label: 'Uniswap',
      origin: 'https://app.uniswap.org',
      status: 'ACTIVE',
      networks: ['ETHEREUM'],
      accounts: ['0x1111111111111111111111111111111111111111'],
      uri: 'wc:7f3a@2?relay-protocol=irn&symKey=abc123secret',
      symKey: 'abc123secret',
      encryptedUri: 'enc',
      sessionKey: 'sk',
      qrPayload: 'wc:topic@2?symKey=fff',
      deepLink: 'auvora://wc?uri=wc:x',
    };
    const stripped = stripSecretFields(raw) as Record<string, unknown>;
    expect(stripped.uri).toBeUndefined();
    expect(stripped.symKey).toBeUndefined();
    expect(stripped.encryptedUri).toBeUndefined();
    expect(stripped.sessionKey).toBeUndefined();
    expect(stripped.qrPayload).toBeUndefined();
    expect(stripped.label).toBe('Uniswap');
    const view = toSafeConnectionView(raw);
    expect(view?.name).toBe('Uniswap');
    expect(view?.domain).toBe('app.uniswap.org');
    expect(JSON.stringify(view)).not.toMatch(/symKey/i);
    expect(containsSecretMaterial(view)).toBe(false);
  });
});
