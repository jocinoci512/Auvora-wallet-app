import type { OpenAPIObject } from '@nestjs/swagger';

const PROXY_NOTE =
  'Proxied to the auth service. Request handling, validation, and business logic are owned by @auvora/auth-service.';

function proxyPath(method: string, summary: string, tag: string) {
  return {
    [method.toLowerCase()]: {
      tags: [tag],
      summary,
      description: PROXY_NOTE,
      responses: {
        default: {
          description: 'Response forwarded from auth service',
        },
      },
    },
  };
}

export function buildAuthProxyOpenApiPaths(): OpenAPIObject['paths'] {
  return {
    '/api/v1/auth/register': proxyPath('post', 'Register a new user account', 'auth-proxy'),
    '/api/v1/auth/login': proxyPath('post', 'Authenticate and establish a session', 'auth-proxy'),
    '/api/v1/auth/logout': proxyPath('post', 'End the current session', 'auth-proxy'),
    '/api/v1/auth/refresh': proxyPath('post', 'Refresh access credentials', 'auth-proxy'),
    '/api/v1/auth/forgot-password': proxyPath('post', 'Request a password reset', 'auth-proxy'),
    '/api/v1/auth/reset-password': proxyPath('post', 'Complete a password reset', 'auth-proxy'),
    '/api/v1/auth/verify-email': proxyPath('post', 'Verify an email address', 'auth-proxy'),
    '/api/v1/me': {
      ...proxyPath('get', 'Get the authenticated user profile', 'me-proxy'),
      ...proxyPath('patch', 'Update the authenticated user profile', 'me-proxy'),
    },
    '/api/v1/admin/users': proxyPath('get', 'List users (admin)', 'admin-proxy'),
    '/api/v1/admin/users/{id}': {
      ...proxyPath('get', 'Get a user by id (admin)', 'admin-proxy'),
      ...proxyPath('patch', 'Update a user (admin)', 'admin-proxy'),
      ...proxyPath('delete', 'Deactivate a user (admin)', 'admin-proxy'),
    },
    '/api/v1/admin/sessions': proxyPath('get', 'List active sessions (admin)', 'admin-proxy'),
  };
}
