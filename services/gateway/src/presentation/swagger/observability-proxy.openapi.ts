import type { OpenAPIObject } from '@nestjs/swagger';

const PROXY_NOTE =
  'Proxied to the observability service. Request handling, validation, and business logic are owned by @auvora/observability-service.';

function proxyPath(method: string, summary: string, tag: string) {
  return {
    [method.toLowerCase()]: {
      tags: [tag],
      summary,
      description: PROXY_NOTE,
      responses: {
        default: {
          description: 'Response forwarded from observability service',
        },
      },
    },
  };
}

export function buildObservabilityProxyOpenApiPaths(): OpenAPIObject['paths'] {
  const userTag = 'observability-proxy';
  const adminTag = 'observability-admin-proxy';

  return {
    '/api/v1/observability/status': proxyPath('get', 'Public platform status', userTag),
    '/api/v1/observability/maintenance': proxyPath('get', 'Active maintenance notices', userTag),
    '/api/v1/observability/incidents': proxyPath('get', 'Public incidents', userTag),
    '/api/v1/admin/observability/dashboard': proxyPath('get', 'Operations dashboard', adminTag),
    '/api/v1/admin/observability/metrics': proxyPath('get', 'List SRE metrics', adminTag),
    '/api/v1/admin/observability/traces': proxyPath('get', 'Search traces', adminTag),
    '/api/v1/admin/observability/logs': proxyPath('get', 'Search logs', adminTag),
    '/api/v1/admin/observability/health': proxyPath('get', 'Service health map', adminTag),
    '/api/v1/admin/observability/dependencies': proxyPath('get', 'Dependency graph', adminTag),
    '/api/v1/admin/observability/alerts': proxyPath('get', 'List alerts', adminTag),
    '/api/v1/admin/observability/alert-rules': {
      ...proxyPath('get', 'List alert rules', adminTag),
      ...proxyPath('post', 'Create alert rule', adminTag),
    },
    '/api/v1/admin/observability/alert-rules/{code}': proxyPath(
      'patch',
      'Update / enable / disable alert rule',
      adminTag,
    ),
    '/api/v1/admin/observability/incidents': proxyPath('get', 'List incidents', adminTag),
    '/api/v1/admin/observability/slos': proxyPath('get', 'List SLOs', adminTag),
    '/api/v1/admin/observability/slos/compliance': proxyPath(
      'get',
      'SLO compliance vs latency/error/uptime',
      adminTag,
    ),
    '/api/v1/admin/observability/capacity': proxyPath('get', 'Capacity overview', adminTag),
    '/api/v1/admin/infrastructure/dashboard': proxyPath(
      'get',
      'Infrastructure dashboard',
      adminTag,
    ),
    '/api/v1/admin/infrastructure/cluster-health': proxyPath(
      'get',
      'Cluster health summary',
      adminTag,
    ),
    '/api/v1/admin/infrastructure/environments': proxyPath('get', 'List environments', adminTag),
    '/api/v1/admin/infrastructure/deployments': {
      ...proxyPath('get', 'List deployments', adminTag),
      ...proxyPath('post', 'Create deployment record', adminTag),
    },
    '/api/v1/admin/infrastructure/backups': {
      ...proxyPath('get', 'List backup jobs', adminTag),
      ...proxyPath('post', 'Record backup job', adminTag),
    },
    '/api/v1/admin/infrastructure/recovery': proxyPath('get', 'List recovery drills', adminTag),
    '/api/v1/admin/infrastructure/recovery-drills': proxyPath(
      'post',
      'Start recovery drill',
      adminTag,
    ),
    '/api/v1/admin/infrastructure/feature-flags': proxyPath('get', 'List feature flags', adminTag),
    '/api/v1/admin/infrastructure/feature-flags/{code}': proxyPath(
      'patch',
      'Update feature flag',
      adminTag,
    ),
  };
}
