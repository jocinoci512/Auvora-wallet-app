import type { RequestHandler } from 'express';
import { createProxyMiddleware, fixRequestBody } from 'http-proxy-middleware';
import { hardenProxyRequest } from './proxy-hardening';
import { getProxyTimeoutMs } from './proxy-timeout';

/** Specific prefixes so /api/v1/admin/wallets can route to the wallet service. */
export const AUTH_PROXY_PREFIXES = [
  '/api/v1/auth',
  '/api/v1/me',
  '/api/v1/admin/users',
  '/api/v1/admin/audit',
  '/api/v1/admin/operators',
] as const;

function isAuthProxyPath(pathname: string): boolean {
  return AUTH_PROXY_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

export function createAuthProxyMiddleware(authServiceUrl: string): RequestHandler {
  return createProxyMiddleware({
    target: authServiceUrl.replace(/\/$/, ''),
    changeOrigin: true,
    pathFilter: (pathname) => isAuthProxyPath(pathname),
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
