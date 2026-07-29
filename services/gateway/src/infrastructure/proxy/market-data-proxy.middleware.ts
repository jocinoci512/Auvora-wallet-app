import type { RequestHandler } from 'express';
import { createProxyMiddleware, fixRequestBody } from 'http-proxy-middleware';
import { hardenProxyRequest } from './proxy-hardening';
import { getProxyTimeoutMs } from './proxy-timeout';

export const MARKET_DATA_PROXY_PREFIXES = [
  '/api/v1/market-data',
  '/api/v1/admin/market-data',
] as const;

function isMarketDataProxyPath(pathname: string): boolean {
  return MARKET_DATA_PROXY_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

export function createMarketDataProxyMiddleware(marketDataServiceUrl: string): RequestHandler {
  return createProxyMiddleware({
    target: marketDataServiceUrl.replace(/\/$/, ''),
    changeOrigin: true,
    pathFilter: (pathname) => isMarketDataProxyPath(pathname),
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
