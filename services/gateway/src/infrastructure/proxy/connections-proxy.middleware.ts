import type { RequestHandler } from 'express';
import { createProxyMiddleware, fixRequestBody } from 'http-proxy-middleware';
import { hardenProxyRequest } from './proxy-hardening';
import { getProxyTimeoutMs } from './proxy-timeout';

export const CONNECTIONS_PROXY_PREFIXES = [
  '/api/v1/connections',
  '/api/v1/admin/connections',
] as const;

function isConnectionsProxyPath(pathname: string): boolean {
  return CONNECTIONS_PROXY_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

export function createConnectionsProxyMiddleware(connectionsServiceUrl: string): RequestHandler {
  return createProxyMiddleware({
    target: connectionsServiceUrl.replace(/\/$/, ''),
    changeOrigin: true,
    pathFilter: (pathname) => isConnectionsProxyPath(pathname),
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
