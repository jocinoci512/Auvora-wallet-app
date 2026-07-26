import type { RequestHandler } from 'express';
import { createProxyMiddleware, fixRequestBody } from 'http-proxy-middleware';
import { hardenProxyRequest } from './proxy-hardening';

export const CUSTODY_PROXY_PREFIXES = [
  '/api/v1/custody',
  '/api/v1/admin/custody',
] as const;

function isCustodyProxyPath(pathname: string): boolean {
  return CUSTODY_PROXY_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

export function createCustodyProxyMiddleware(custodyServiceUrl: string): RequestHandler {
  return createProxyMiddleware({
    target: custodyServiceUrl.replace(/\/$/, ''),
    changeOrigin: true,
    pathFilter: (pathname) => isCustodyProxyPath(pathname),
    on: {
      proxyReq: (proxyReq, req) => {
        fixRequestBody(proxyReq, req);
        hardenProxyRequest(proxyReq, req);
      },
    },
  });
}
