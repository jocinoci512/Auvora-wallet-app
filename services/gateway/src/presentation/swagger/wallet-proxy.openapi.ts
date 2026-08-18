import type { OpenAPIObject } from '@nestjs/swagger';

const PROXY_NOTE =
  'Proxied to the wallet service. Request handling, validation, and business logic are owned by @auvora/wallet-service.';

function proxyPath(method: string, summary: string, tag: string) {
  return {
    [method.toLowerCase()]: {
      tags: [tag],
      summary,
      description: PROXY_NOTE,
      responses: {
        default: {
          description: 'Response forwarded from wallet service',
        },
      },
    },
  };
}

export function buildWalletProxyOpenApiPaths(): OpenAPIObject['paths'] {
  const walletTag = 'wallet-proxy';
  const adminTag = 'wallet-admin-proxy';

  return {
    '/api/v1/wallets': {
      ...proxyPath('get', 'List wallets for the authenticated user', walletTag),
      ...proxyPath('post', 'Create a wallet', walletTag),
    },
    '/api/v1/wallets/transfers/prepare': proxyPath(
      'post',
      'Prepare a user transfer and persist a large-transfer review when required',
      walletTag,
    ),
    '/api/v1/wallets/{walletId}': {
      ...proxyPath('get', 'Get wallet details', walletTag),
      ...proxyPath('patch', 'Update wallet alias, label, or preferences', walletTag),
    },
    '/api/v1/wallets/{walletId}/activate': proxyPath(
      'post',
      'Activate a pending wallet',
      walletTag,
    ),
    '/api/v1/wallets/{walletId}/suspend': proxyPath('post', 'Suspend a wallet', walletTag),
    '/api/v1/wallets/{walletId}/archive': proxyPath('post', 'Archive a wallet', walletTag),
    '/api/v1/wallets/{walletId}/restore': proxyPath(
      'post',
      'Restore an archived wallet',
      walletTag,
    ),
    '/api/v1/wallets/{walletId}/balance': proxyPath('get', 'Get wallet balance', walletTag),
    '/api/v1/wallets/{walletId}/transactions': proxyPath(
      'get',
      'List wallet transactions',
      walletTag,
    ),
    '/api/v1/wallets/{walletId}/snapshot': proxyPath('post', 'Snapshot wallet balance', walletTag),
    '/api/v1/wallets/{walletId}/balance-history': proxyPath(
      'get',
      'Get balance history',
      walletTag,
    ),
    '/api/v1/wallets/{walletId}/balance-audits': proxyPath('get', 'Get balance audits', walletTag),
    '/api/v1/wallets/{walletId}/status-history': proxyPath(
      'get',
      'Get wallet status history',
      walletTag,
    ),
    '/api/v1/admin/wallets': proxyPath('get', 'Search wallets (admin)', adminTag),
    '/api/v1/admin/wallets/{walletId}': proxyPath('get', 'Get wallet by id (admin)', adminTag),
    '/api/v1/admin/wallets/{walletId}/suspend': proxyPath(
      'post',
      'Suspend wallet (admin)',
      adminTag,
    ),
    '/api/v1/admin/wallets/{walletId}/restore': proxyPath(
      'post',
      'Restore wallet (admin)',
      adminTag,
    ),
    '/api/v1/admin/wallets/{walletId}/archive': proxyPath(
      'post',
      'Archive wallet (admin)',
      adminTag,
    ),
    '/api/v1/admin/wallets/{walletId}/balance': proxyPath(
      'get',
      'Get wallet balance (admin)',
      adminTag,
    ),
    '/api/v1/admin/wallets/{walletId}/transactions': proxyPath(
      'get',
      'List wallet transactions (admin)',
      adminTag,
    ),
  };
}
