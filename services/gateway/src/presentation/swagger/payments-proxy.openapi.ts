import type { OpenAPIObject } from '@nestjs/swagger';

const PROXY_NOTE =
  'Proxied to the payments service. Request handling, validation, and business logic are owned by @auvora/payments-service.';

function proxyPath(method: string, summary: string, tag: string) {
  return {
    [method.toLowerCase()]: {
      tags: [tag],
      summary,
      description: PROXY_NOTE,
      responses: {
        default: {
          description: 'Response forwarded from payments service',
        },
      },
    },
  };
}

export function buildPaymentsProxyOpenApiPaths(): OpenAPIObject['paths'] {
  const userTag = 'payments-proxy';
  const adminTag = 'payments-admin-proxy';

  return {
    '/api/v1/payments': {
      ...proxyPath('get', 'Search payments for the authenticated user', userTag),
      ...proxyPath('post', 'Create a payment', userTag),
    },
    '/api/v1/payments/transfers': proxyPath('post', 'Create a wallet transfer payment', userTag),
    '/api/v1/payments/requests': proxyPath('post', 'Create a payment request', userTag),
    '/api/v1/payments/methods': {
      ...proxyPath('get', 'List payment methods', userTag),
      ...proxyPath('post', 'Create a payment method', userTag),
    },
    '/api/v1/payments/limits': proxyPath('get', 'List applicable payment limits', userTag),
    '/api/v1/payments/statistics': proxyPath('get', 'Payment statistics for the user', userTag),
    '/api/v1/payments/{id}': proxyPath('get', 'Get payment by id', userTag),
    '/api/v1/payments/{id}/receipt': proxyPath('get', 'Download payment receipt metadata', userTag),
    '/api/v1/payments/{id}/cancel': proxyPath('post', 'Cancel a payment', userTag),
    '/api/v1/payments/{id}/refund': proxyPath('post', 'Refund a payment', userTag),
    '/api/v1/admin/payments': proxyPath('get', 'Admin search payments', adminTag),
    '/api/v1/admin/payments/metrics': proxyPath('get', 'Payment dashboard metrics', adminTag),
    '/api/v1/admin/payments/providers': proxyPath('get', 'List payment providers', adminTag),
    '/api/v1/admin/payments/health': proxyPath('get', 'Provider health snapshots', adminTag),
    '/api/v1/admin/payments/settlements': proxyPath('get', 'List settlements', adminTag),
    '/api/v1/admin/payments/settlements/run': proxyPath('post', 'Run a settlement', adminTag),
    '/api/v1/admin/payments/settlements/batches': proxyPath(
      'get',
      'List settlement batches',
      adminTag,
    ),
    '/api/v1/admin/payments/settlements/reports': proxyPath('get', 'Settlement reports', adminTag),
    '/api/v1/admin/payments/limits': {
      ...proxyPath('get', 'List payment limits', adminTag),
      ...proxyPath('post', 'Create a payment limit', adminTag),
    },
    '/api/v1/admin/payments/refunds': proxyPath('get', 'List refunds', adminTag),
    '/api/v1/admin/payments/disputes': proxyPath('get', 'List disputes', adminTag),
    '/api/v1/admin/payments/chargebacks': proxyPath('get', 'List chargebacks', adminTag),
    '/api/v1/admin/payments/reconciliation': proxyPath('get', 'Reconciliation queue', adminTag),
    '/api/v1/admin/payments/reconciliation/run': proxyPath('post', 'Run reconciliation', adminTag),
  };
}
