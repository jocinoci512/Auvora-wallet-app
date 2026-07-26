import type { RequestHandler } from 'express';
import { createProxyMiddleware, fixRequestBody } from 'http-proxy-middleware';
import { hardenProxyRequest } from './proxy-hardening';

export const AI_PROXY_PREFIXES = ['/api/v1/ai', '/api/v1/admin/ai'] as const;

function isAiProxyPath(pathname: string): boolean {
  return AI_PROXY_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export function createAiProxyMiddleware(aiServiceUrl: string): RequestHandler {
  return createProxyMiddleware({
    target: aiServiceUrl.replace(/\/$/, ''),
    changeOrigin: true,
    pathFilter: (pathname) => isAiProxyPath(pathname),
    on: {
      proxyReq: (proxyReq, req) => {
        fixRequestBody(proxyReq, req);
        hardenProxyRequest(proxyReq, req);
      },
    },
  });
}
