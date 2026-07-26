import type { RequestHandler } from 'express';
import { createProxyMiddleware, fixRequestBody } from 'http-proxy-middleware';
import { hardenProxyRequest } from './proxy-hardening';

export const ANALYTICS_PROXY_PREFIXES = ['/api/v1/analytics', '/api/v1/admin/analytics'] as const;

function isAnalyticsProxyPath(pathname: string): boolean {
  return ANALYTICS_PROXY_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

export function createAnalyticsProxyMiddleware(analyticsServiceUrl: string): RequestHandler {
  return createProxyMiddleware({
    target: analyticsServiceUrl.replace(/\/$/, ''),
    changeOrigin: true,
    pathFilter: (pathname) => isAnalyticsProxyPath(pathname),
    on: {
      proxyReq: (proxyReq, req) => {
        fixRequestBody(proxyReq, req);
        hardenProxyRequest(proxyReq, req);
      },
    },
  });
}
