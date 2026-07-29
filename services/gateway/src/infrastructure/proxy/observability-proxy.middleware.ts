import type { RequestHandler } from 'express';
import { createProxyMiddleware, fixRequestBody } from 'http-proxy-middleware';
import { hardenProxyRequest } from './proxy-hardening';
import { getProxyTimeoutMs } from './proxy-timeout';

export const OBSERVABILITY_PROXY_PREFIXES = [
  '/api/v1/observability',
  '/api/v1/admin/observability',
  '/api/v1/admin/infrastructure',
] as const;

function isObservabilityProxyPath(pathname: string): boolean {
  return OBSERVABILITY_PROXY_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

export function createObservabilityProxyMiddleware(
  observabilityServiceUrl: string,
): RequestHandler {
  return createProxyMiddleware({
    target: observabilityServiceUrl.replace(/\/$/, ''),
    changeOrigin: true,
    pathFilter: (pathname) => isObservabilityProxyPath(pathname),
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
