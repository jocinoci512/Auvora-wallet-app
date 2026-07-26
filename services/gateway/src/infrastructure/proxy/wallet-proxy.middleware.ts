import type { RequestHandler } from 'express';
import { createProxyMiddleware, fixRequestBody } from 'http-proxy-middleware';
import { hardenProxyRequest } from './proxy-hardening';
import { getProxyTimeoutMs } from './proxy-timeout';

export const WALLET_PROXY_PREFIXES = [
  '/api/v1/wallets',
  '/api/v1/admin/wallets',
] as const;

function isWalletProxyPath(pathname: string): boolean {
  return WALLET_PROXY_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

export function createWalletProxyMiddleware(walletServiceUrl: string): RequestHandler {
  return createProxyMiddleware({
    target: walletServiceUrl.replace(/\/$/, ''),
    changeOrigin: true,
    pathFilter: (pathname) => isWalletProxyPath(pathname),
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
