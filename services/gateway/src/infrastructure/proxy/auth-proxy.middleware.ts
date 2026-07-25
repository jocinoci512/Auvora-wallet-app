import type { RequestHandler } from 'express';
import { createProxyMiddleware, fixRequestBody } from 'http-proxy-middleware';

/** Specific prefixes so /api/v1/admin/wallets can route to the wallet service. */
export const AUTH_PROXY_PREFIXES = [
  '/api/v1/auth',
  '/api/v1/me',
  '/api/v1/admin/users',
  '/api/v1/admin/audit',
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
