import { buildWalletProxyOpenApiPaths } from './wallet-proxy.openapi';

describe('wallet proxy OpenAPI', () => {
  const paths = buildWalletProxyOpenApiPaths() ?? {};

  it('documents user transfer prepare and omits removed admin wallet mutations', () => {
    expect(paths['/api/v1/wallets/transfers/prepare']).toBeDefined();
    expect(paths['/api/v1/admin/wallets/{walletId}/credit']).toBeUndefined();
    expect(paths['/api/v1/admin/wallets/{walletId}/debit']).toBeUndefined();
    expect(paths['/api/v1/admin/wallets/{walletId}/transfer']).toBeUndefined();
  });
});
