import type { RequestHandler } from 'express';
import { createProxyMiddleware, fixRequestBody } from 'http-proxy-middleware';
import { hardenProxyRequest } from './proxy-hardening';
import { getProxyTimeoutMs } from './proxy-timeout';

export const NOTIFICATIONS_PROXY_PREFIXES = [
  '/api/v1/notifications',
  '/api/v1/admin/notifications',
] as const;

function isNotificationsProxyPath(pathname: string): boolean {
  return NOTIFICATIONS_PROXY_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

export function createNotificationsProxyMiddleware(notificationsServiceUrl: string): RequestHandler {
  return createProxyMiddleware({
    target: notificationsServiceUrl.replace(/\/$/, ''),
    changeOrigin: true,
    pathFilter: (pathname) => isNotificationsProxyPath(pathname),
    timeout: getProxyTimeoutMs(),
    proxyTimeout: getProxyTimeoutMs(),
    on: {
      proxyReq: (proxyReq, req) => {
        fixRequestBody(proxyReq, req);
        hardenProxyRequest(proxyReq, req);
      },
    },
  });
}
