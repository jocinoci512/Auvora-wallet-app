import type { OpenAPIObject } from '@nestjs/swagger';

const PROXY_NOTE =
  'Proxied to the analytics service. Request handling, validation, and business logic are owned by @auvora/analytics-service.';

function proxyPath(method: string, summary: string, tag: string) {
  return {
    [method.toLowerCase()]: {
      tags: [tag],
      summary,
      description: PROXY_NOTE,
      responses: {
        default: {
          description: 'Response forwarded from analytics service',
        },
      },
    },
  };
}

export function buildAnalyticsProxyOpenApiPaths(): OpenAPIObject['paths'] {
  const userTag = 'analytics-proxy';
  const adminTag = 'analytics-admin-proxy';

  return {
    '/api/v1/analytics/summary': proxyPath('get', 'Personal analytics summary', userTag),
    '/api/v1/analytics/dashboards': proxyPath('get', 'List accessible dashboards', userTag),
    '/api/v1/analytics/dashboards/{id}': proxyPath('get', 'Get dashboard with widgets', userTag),
    '/api/v1/analytics/reports': {
      ...proxyPath('get', 'List own reports', userTag),
      ...proxyPath('post', 'Generate a report', userTag),
    },
    '/api/v1/analytics/reports/{id}': proxyPath('get', 'Get report status and result', userTag),
    '/api/v1/analytics/kpis': proxyPath('get', 'List KPI snapshots', userTag),
    '/api/v1/analytics/insights': proxyPath('get', 'Platform insights overview', userTag),
    '/api/v1/admin/analytics/dashboard': proxyPath('get', 'Admin analytics dashboard', adminTag),
    '/api/v1/admin/analytics/performance': proxyPath(
      'get',
      'Dashboard/report/aggregation performance SLIs',
      adminTag,
    ),
    '/api/v1/admin/analytics/metrics': {
      ...proxyPath('get', 'List metric definitions', adminTag),
      ...proxyPath('post', 'Create metric definition', adminTag),
    },
    '/api/v1/admin/analytics/metrics/{code}': proxyPath(
      'patch',
      'Update metric definition',
      adminTag,
    ),
    '/api/v1/admin/analytics/forecasts': proxyPath('get', 'List forecast models', adminTag),
    '/api/v1/admin/analytics/forecasts/{code}/run': proxyPath(
      'post',
      'Run forecast model',
      adminTag,
    ),
    '/api/v1/admin/analytics/aggregate/run': proxyPath('post', 'Trigger aggregation run', adminTag),
    '/api/v1/admin/analytics/dashboards': proxyPath('get', 'List all dashboards', adminTag),
    '/api/v1/admin/analytics/kpis': {
      ...proxyPath('get', 'List KPI definitions', adminTag),
      ...proxyPath('post', 'Create KPI definition', adminTag),
    },
    '/api/v1/admin/analytics/kpis/{code}': proxyPath('patch', 'Update KPI definition', adminTag),
    '/api/v1/admin/analytics/scheduled-reports': {
      ...proxyPath('get', 'List scheduled reports', adminTag),
      ...proxyPath('post', 'Create scheduled report', adminTag),
    },
    '/api/v1/admin/analytics/scheduled-reports/{id}/pause': proxyPath(
      'post',
      'Pause scheduled report',
      adminTag,
    ),
    '/api/v1/admin/analytics/scheduled-reports/{id}/resume': proxyPath(
      'post',
      'Resume scheduled report',
      adminTag,
    ),
  };
}
