import type { RequestHandler } from 'express';
import { createProxyMiddleware, fixRequestBody } from 'http-proxy-middleware';
import { hardenProxyRequest } from './proxy-hardening';
import { getProxyTimeoutMs } from './proxy-timeout';

export const COMPLIANCE_PROXY_PREFIXES = [
  '/api/v1/compliance',
  '/api/v1/admin/compliance',
] as const;

function isComplianceProxyPath(pathname: string): boolean {
  return COMPLIANCE_PROXY_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

export function createComplianceProxyMiddleware(complianceServiceUrl: string): RequestHandler {
  return createProxyMiddleware({
    target: complianceServiceUrl.replace(/\/$/, ''),
    changeOrigin: true,
    pathFilter: (pathname) => isComplianceProxyPath(pathname),
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
