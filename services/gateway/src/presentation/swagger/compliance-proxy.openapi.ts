import type { OpenAPIObject } from '@nestjs/swagger';

const PROXY_NOTE =
  'Proxied to the compliance service. Request handling, validation, and business logic are owned by @auvora/compliance-service.';

function proxyPath(method: string, summary: string, tag: string) {
  return {
    [method.toLowerCase()]: {
      tags: [tag],
      summary,
      description: PROXY_NOTE,
      responses: {
        default: {
          description: 'Response forwarded from compliance service',
        },
      },
    },
  };
}

export function buildComplianceProxyOpenApiPaths(): OpenAPIObject['paths'] {
  const userTag = 'compliance-proxy';
  const adminTag = 'compliance-admin-proxy';

  return {
    '/api/v1/compliance/profile': proxyPath('get', 'Get own KYC/compliance profile', userTag),
    '/api/v1/compliance/kyc': proxyPath('post', 'Submit KYC verification request', userTag),
    '/api/v1/compliance/kyc/status': proxyPath('get', 'Get KYC verification status', userTag),
    '/api/v1/compliance/documents': {
      ...proxyPath('get', 'List own compliance documents', userTag),
      ...proxyPath('post', 'Upload compliance document metadata', userTag),
    },
    '/api/v1/compliance/risk': proxyPath('get', 'Get own risk score', userTag),
    '/api/v1/compliance/risk/history': proxyPath('get', 'Get own risk score history', userTag),
    '/api/v1/compliance/sanctions': proxyPath('get', 'Get own sanctions screening results', userTag),
    '/api/v1/compliance/pep': proxyPath('get', 'Get own PEP screening results', userTag),
    '/api/v1/admin/compliance/dashboard': proxyPath('get', 'Compliance dashboard metrics', adminTag),
    '/api/v1/admin/compliance/kyc/queue': proxyPath('get', 'KYC review queue', adminTag),
    '/api/v1/admin/compliance/kyc/{id}/approve': proxyPath('post', 'Approve KYC verification', adminTag),
    '/api/v1/admin/compliance/kyc/{id}/reject': proxyPath('post', 'Reject KYC verification', adminTag),
    '/api/v1/admin/compliance/documents': proxyPath('get', 'Document review queue', adminTag),
    '/api/v1/admin/compliance/alerts': proxyPath('get', 'AML alerts', adminTag),
    '/api/v1/admin/compliance/risk': proxyPath('get', 'Risk dashboard', adminTag),
    '/api/v1/admin/compliance/risk/{ownerUserId}/recompute': proxyPath(
      'post',
      'Recompute customer risk score',
      adminTag,
    ),
    '/api/v1/admin/compliance/fraud': proxyPath('get', 'Fraud dashboard', adminTag),
    '/api/v1/admin/compliance/sanctions': proxyPath('get', 'Sanctions screening results', adminTag),
    '/api/v1/admin/compliance/pep': proxyPath('get', 'PEP screening results', adminTag),
    '/api/v1/admin/compliance/cases': {
      ...proxyPath('get', 'List compliance cases', adminTag),
      ...proxyPath('post', 'Open a compliance case', adminTag),
    },
    '/api/v1/admin/compliance/cases/{id}': proxyPath('get', 'Case details', adminTag),
    '/api/v1/admin/compliance/rules': {
      ...proxyPath('get', 'List compliance rules', adminTag),
      ...proxyPath('post', 'Create compliance rule', adminTag),
    },
    '/api/v1/admin/compliance/rules/{id}': {
      ...proxyPath('get', 'Get compliance rule', adminTag),
      ...proxyPath('patch', 'Update compliance rule', adminTag),
    },
    '/api/v1/admin/compliance/rules/{id}/enable': proxyPath('post', 'Enable compliance rule', adminTag),
    '/api/v1/admin/compliance/rules/{id}/disable': proxyPath('post', 'Disable compliance rule', adminTag),
    '/api/v1/admin/compliance/providers': proxyPath('get', 'List compliance providers', adminTag),
    '/api/v1/admin/compliance/reports': proxyPath('get', 'Compliance reports summary', adminTag),
  };
}
