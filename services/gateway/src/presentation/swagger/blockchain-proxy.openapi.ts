import type { OpenAPIObject } from '@nestjs/swagger';

const PROXY_NOTE =
  'Proxied to the blockchain service. Request handling, validation, and business logic are owned by @auvora/blockchain-service.';

function proxyPath(method: string, summary: string, tag: string) {
  return {
    [method.toLowerCase()]: {
      tags: [tag],
      summary,
      description: PROXY_NOTE,
      responses: {
        default: {
          description: 'Response forwarded from blockchain service',
        },
      },
    },
  };
}

export function buildBlockchainProxyOpenApiPaths(): OpenAPIObject['paths'] {
  const chainTag = 'blockchain-proxy';
  const adminTag = 'blockchain-admin-proxy';

  return {
    '/api/v1/blockchain/chains': proxyPath('get', 'List supported chains and network config', chainTag),
    '/api/v1/blockchain/network-status': proxyPath(
      'get',
      'Get network status per chain (block height, health, latency)',
      chainTag,
    ),
    '/api/v1/blockchain/addresses': {
      ...proxyPath('get', 'List addresses for the authenticated user', chainTag),
      ...proxyPath('post', 'Create a chain address', chainTag),
    },
    '/api/v1/blockchain/addresses/validate': proxyPath(
      'post',
      'Validate an address for a given chain',
      chainTag,
    ),
    '/api/v1/blockchain/addresses/{addressId}': {
      ...proxyPath('get', 'Get address details', chainTag),
      ...proxyPath('patch', 'Update address label or watch flag', chainTag),
    },
    '/api/v1/blockchain/addresses/{addressId}/activate': proxyPath(
      'post',
      'Activate a pending address',
      chainTag,
    ),
    '/api/v1/blockchain/addresses/{addressId}/archive': proxyPath(
      'post',
      'Archive an address',
      chainTag,
    ),
    '/api/v1/blockchain/addresses/{addressId}/set-primary': proxyPath(
      'post',
      'Mark address as the primary address for its chain',
      chainTag,
    ),
    '/api/v1/blockchain/addresses/{addressId}/balance': proxyPath(
      'get',
      'Get on-chain balance for an address',
      chainTag,
    ),
    '/api/v1/blockchain/transactions': proxyPath(
      'get',
      'List chain transactions for the authenticated user',
      chainTag,
    ),
    '/api/v1/blockchain/transactions/{transactionId}': proxyPath(
      'get',
      'Get chain transaction details',
      chainTag,
    ),
    '/api/v1/blockchain/fees/estimate': proxyPath('post', 'Estimate network fee', chainTag),
    '/api/v1/admin/blockchain/providers': proxyPath(
      'get',
      'List blockchain providers and configuration (admin)',
      adminTag,
    ),
    '/api/v1/admin/blockchain/health': proxyPath(
      'get',
      'Get provider health snapshots (admin)',
      adminTag,
    ),
    '/api/v1/admin/blockchain/sync-jobs': proxyPath('get', 'List sync jobs (admin)', adminTag),
    '/api/v1/admin/blockchain/sync-jobs/trigger': proxyPath(
      'post',
      'Trigger a sync job (admin)',
      adminTag,
    ),
    '/api/v1/admin/blockchain/blocks': proxyPath('get', 'List recent chain blocks (admin)', adminTag),
    '/api/v1/admin/blockchain/transactions': proxyPath(
      'get',
      'List chain transactions across all users (admin)',
      adminTag,
    ),
    '/api/v1/admin/blockchain/addresses': proxyPath(
      'get',
      'Search chain addresses across all users (admin)',
      adminTag,
    ),
    '/api/v1/admin/blockchain/metrics': proxyPath('get', 'Get blockchain service metrics (admin)', adminTag),
    '/api/v1/admin/blockchain/events': proxyPath('get', 'List blockchain event log entries (admin)', adminTag),
  };
}
