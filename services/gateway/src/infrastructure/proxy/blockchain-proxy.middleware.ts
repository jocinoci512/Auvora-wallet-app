import type { RequestHandler } from 'express';
import { createProxyMiddleware, fixRequestBody } from 'http-proxy-middleware';
import { hardenProxyRequest } from './proxy-hardening';
import { getProxyTimeoutMs } from './proxy-timeout';

export const BLOCKCHAIN_PROXY_PREFIXES = [
  '/api/v1/blockchain',
  '/api/v1/admin/blockchain',
] as const;

function isBlockchainProxyPath(pathname: string): boolean {
  return BLOCKCHAIN_PROXY_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

export function createBlockchainProxyMiddleware(blockchainServiceUrl: string): RequestHandler {
  return createProxyMiddleware({
    target: blockchainServiceUrl.replace(/\/$/, ''),
    changeOrigin: true,
    pathFilter: (pathname) => isBlockchainProxyPath(pathname),
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
