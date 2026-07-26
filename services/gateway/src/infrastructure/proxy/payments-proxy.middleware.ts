import type { RequestHandler } from 'express';
import { createProxyMiddleware, fixRequestBody } from 'http-proxy-middleware';
import { hardenProxyRequest } from './proxy-hardening';

export const PAYMENTS_PROXY_PREFIXES = ['/api/v1/payments', '/api/v1/admin/payments'] as const;

function isPaymentsProxyPath(pathname: string): boolean {
  return PAYMENTS_PROXY_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

export function createPaymentsProxyMiddleware(paymentsServiceUrl: string): RequestHandler {
  return createProxyMiddleware({
    target: paymentsServiceUrl.replace(/\/$/, ''),
    changeOrigin: true,
    pathFilter: (pathname) => isPaymentsProxyPath(pathname),
    on: {
      proxyReq: (proxyReq, req) => {
        fixRequestBody(proxyReq, req);
        hardenProxyRequest(proxyReq, req);
      },
    },
  });
}
