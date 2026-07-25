import type { RequestHandler } from 'express';
import { createProxyMiddleware, fixRequestBody } from 'http-proxy-middleware';

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
    on: {
      proxyReq: (proxyReq, req) => {
        fixRequestBody(proxyReq, req);

        const existing = req.headers['x-forwarded-for'];
        const clientIp = req.ip ?? req.socket.remoteAddress;
        if (typeof existing === 'string' && existing.length > 0) {
          proxyReq.setHeader('x-forwarded-for', clientIp ? `${existing}, ${clientIp}` : existing);
        } else if (clientIp) {
          proxyReq.setHeader('x-forwarded-for', clientIp);
        }
      },
    },
  });
}
