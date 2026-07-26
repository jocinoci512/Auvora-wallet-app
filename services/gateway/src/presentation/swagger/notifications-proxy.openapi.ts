import type { OpenAPIObject } from '@nestjs/swagger';

const PROXY_NOTE =
  'Proxied to the notifications service. Request handling, validation, and business logic are owned by @auvora/notifications-service.';

function proxyPath(method: string, summary: string, tag: string) {
  return {
    [method.toLowerCase()]: {
      tags: [tag],
      summary,
      description: PROXY_NOTE,
      responses: {
        default: {
          description: 'Response forwarded from notifications service',
        },
      },
    },
  };
}

export function buildNotificationsProxyOpenApiPaths(): OpenAPIObject['paths'] {
  const userTag = 'notifications-proxy';
  const adminTag = 'notifications-admin-proxy';

  return {
    '/api/v1/notifications': proxyPath('get', 'List own notifications', userTag),
    '/api/v1/notifications/preferences': {
      ...proxyPath('get', 'Get notification preferences', userTag),
      ...proxyPath('put', 'Update notification preferences', userTag),
    },
    '/api/v1/notifications/webhooks': {
      ...proxyPath('get', 'List own webhook endpoints', userTag),
      ...proxyPath('post', 'Register webhook endpoint', userTag),
    },
    '/api/v1/notifications/{id}': proxyPath('get', 'Get notification', userTag),
    '/api/v1/notifications/{id}/read': proxyPath('post', 'Mark notification read', userTag),
    '/api/v1/admin/notifications/dashboard': proxyPath('get', 'Notification dashboard', adminTag),
    '/api/v1/admin/notifications/templates': {
      ...proxyPath('get', 'List templates', adminTag),
      ...proxyPath('post', 'Create template', adminTag),
    },
    '/api/v1/admin/notifications/queue': proxyPath('get', 'Queue monitor', adminTag),
    '/api/v1/admin/notifications/failed': proxyPath('get', 'Failed / dead-letter deliveries', adminTag),
    '/api/v1/admin/notifications/providers': proxyPath('get', 'Channel providers', adminTag),
    '/api/v1/admin/notifications/broadcast': proxyPath('post', 'Admin broadcast', adminTag),
    '/api/v1/admin/notifications/webhooks': proxyPath('get', 'Admin webhook manager', adminTag),
  };
}
