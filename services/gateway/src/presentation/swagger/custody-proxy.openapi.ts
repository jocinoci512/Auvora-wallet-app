import type { OpenAPIObject } from '@nestjs/swagger';

const PROXY_NOTE =
  'Proxied to the custody service. Request handling, validation, and business logic are owned by @auvora/custody-service.';

function proxyPath(method: string, summary: string, tag: string) {
  return {
    [method.toLowerCase()]: {
      tags: [tag],
      summary,
      description: PROXY_NOTE,
      responses: {
        default: {
          description: 'Response forwarded from custody service',
        },
      },
    },
  };
}

export function buildCustodyProxyOpenApiPaths(): OpenAPIObject['paths'] {
  const userTag = 'custody-proxy';
  const adminTag = 'custody-admin-proxy';

  return {
    '/api/v1/custody/keys': {
      ...proxyPath('get', 'List own cryptographic keys', userTag),
      ...proxyPath('post', 'Generate a cryptographic key', userTag),
    },
    '/api/v1/custody/keys/{id}': proxyPath('get', 'Get key metadata', userTag),
    '/api/v1/custody/keys/{id}/rotate': proxyPath('post', 'Rotate key', userTag),
    '/api/v1/custody/signing-requests': {
      ...proxyPath('get', 'List signing requests', userTag),
      ...proxyPath('post', 'Create signing request', userTag),
    },
    '/api/v1/custody/signing-requests/{id}': proxyPath('get', 'Get signing request', userTag),
    '/api/v1/custody/signing-requests/{id}/approve': proxyPath(
      'post',
      'Approve signing request',
      userTag,
    ),
    '/api/v1/custody/signing-requests/{id}/reject': proxyPath(
      'post',
      'Reject signing request',
      userTag,
    ),
    '/api/v1/custody/recovery/contacts': {
      ...proxyPath('get', 'List recovery contacts', userTag),
      ...proxyPath('post', 'Add recovery contact', userTag),
    },
    '/api/v1/custody/recovery/start': proxyPath('post', 'Start recovery', userTag),
    '/api/v1/custody/recovery': proxyPath('get', 'List own recovery requests', userTag),
    '/api/v1/custody/security/activity': proxyPath('get', 'Security activity / key audit', userTag),
    '/api/v1/custody/status': proxyPath('get', 'Custody status summary', userTag),
    '/api/v1/admin/custody/dashboard': proxyPath('get', 'Custody dashboard metrics', adminTag),
    '/api/v1/admin/custody/keys': proxyPath('get', 'Admin list keys', adminTag),
    '/api/v1/admin/custody/signing/queue': proxyPath('get', 'Signing queue', adminTag),
    '/api/v1/admin/custody/approvals/queue': proxyPath('get', 'Approval queue', adminTag),
    '/api/v1/admin/custody/recovery/queue': proxyPath('get', 'Recovery queue', adminTag),
    '/api/v1/admin/custody/policies/approval': {
      ...proxyPath('get', 'List approval policies', adminTag),
      ...proxyPath('post', 'Create approval policy', adminTag),
    },
    '/api/v1/admin/custody/policies/transaction': {
      ...proxyPath('get', 'List transaction policies', adminTag),
      ...proxyPath('post', 'Create transaction policy', adminTag),
    },
    '/api/v1/admin/custody/signer-groups': {
      ...proxyPath('get', 'List signer groups', adminTag),
      ...proxyPath('post', 'Create signer group', adminTag),
    },
    '/api/v1/admin/custody/providers': proxyPath('get', 'List custody providers', adminTag),
    '/api/v1/admin/custody/audit': proxyPath('get', 'Custody audit viewer', adminTag),
  };
}
