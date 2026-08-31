import type { IncomingMessage } from 'node:http';
import type { RequestHandler } from 'express';
import { createProxyMiddleware, fixRequestBody } from 'http-proxy-middleware';
import { isAllowedCorsOrigin } from '@auvora/security';
import type { ServiceEnv } from '../../config/env.schema';
import { AUTH_PROXY_PREFIXES } from './auth-proxy.middleware';
import { WALLET_PROXY_PREFIXES } from './wallet-proxy.middleware';
import { BLOCKCHAIN_PROXY_PREFIXES } from './blockchain-proxy.middleware';
import { PAYMENTS_PROXY_PREFIXES } from './payments-proxy.middleware';
import { COMPLIANCE_PROXY_PREFIXES } from './compliance-proxy.middleware';
import { CUSTODY_PROXY_PREFIXES } from './custody-proxy.middleware';
import { NOTIFICATIONS_PROXY_PREFIXES } from './notifications-proxy.middleware';
import { ANALYTICS_PROXY_PREFIXES } from './analytics-proxy.middleware';
import { AI_PROXY_PREFIXES } from './ai-proxy.middleware';
import { OBSERVABILITY_PROXY_PREFIXES } from './observability-proxy.middleware';
import { MARKET_DATA_PROXY_PREFIXES } from './market-data-proxy.middleware';
import { SWAP_PROXY_PREFIXES } from './swap-proxy.middleware';
import { STAKING_PROXY_PREFIXES } from './staking-proxy.middleware';
import { CONNECTIONS_PROXY_PREFIXES } from './connections-proxy.middleware';
import { BRIDGE_PROXY_PREFIXES } from './bridge-proxy.middleware';
import { hardenProxyRequest } from './proxy-hardening';
import { getProxyTimeoutMs } from './proxy-timeout';

const UPSTREAM_CORS_HEADER_NAMES = [
  'access-control-allow-origin',
  'access-control-allow-credentials',
  'access-control-allow-methods',
  'access-control-allow-headers',
  'access-control-expose-headers',
  'access-control-max-age',
] as const;

/**
 * Upstream Nest services often set a static ACAO (e.g. APP_PUBLIC_URL) and CORP:same-origin.
 * Those headers overwrite Gateway CORS on the way out and can leak a fixed ACAO for wrong
 * Origins, or block credentialed browser reads. Gateway owns browser CORS at the edge.
 */
function applyGatewayBrowserHeaders(
  proxyRes: IncomingMessage,
  req: IncomingMessage,
  corsAllowlist: readonly string[],
): void {
  if (!proxyRes.headers) return;

  for (const name of UPSTREAM_CORS_HEADER_NAMES) {
    delete proxyRes.headers[name];
  }

  // Upstream Nest/helmet CORP:same-origin blocks Web (:3000) from reading Gateway (:4000).
  proxyRes.headers['cross-origin-resource-policy'] = 'cross-origin';

  const requestOriginHeader = req.headers['origin'];
  const requestOrigin = Array.isArray(requestOriginHeader)
    ? requestOriginHeader[0]
    : requestOriginHeader;

  if (requestOrigin && isAllowedCorsOrigin(requestOrigin, corsAllowlist)) {
    proxyRes.headers['access-control-allow-origin'] = requestOrigin;
    proxyRes.headers['access-control-allow-credentials'] = 'true';
    const vary = proxyRes.headers['vary'];
    const varyParts = (typeof vary === 'string' ? vary.split(',') : [])
      .map((part) => part.trim())
      .filter(Boolean);
    if (!varyParts.some((part) => part.toLowerCase() === 'origin')) {
      varyParts.push('Origin');
    }
    proxyRes.headers['vary'] = varyParts.join(', ');
  }
}

type ProxyRoute = {
  name: string;
  prefixes: readonly string[];
  target: string | undefined;
};

function matchesPrefix(pathname: string, prefixes: readonly string[]): boolean {
  return prefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

function pathnameOf(url: string | undefined): string {
  if (!url) return '';
  const q = url.indexOf('?');
  return q === -1 ? url : url.slice(0, q);
}

/**
 * Single http-proxy-middleware instance for all upstreams.
 *
 * WHY: each createProxyMiddleware() attaches server.on('close') on the first
 * request that reaches it (including /health via app.use chain). Fifteen
 * separate proxies → MaxListenersExceededWarning (11 > default 10).
 * One middleware → one close listener; no setMaxListeners workaround.
 */
export function createUnifiedGatewayProxyMiddleware(env: ServiceEnv): RequestHandler {
  const routes: ProxyRoute[] = [
    { name: 'auth', prefixes: AUTH_PROXY_PREFIXES, target: env.AUTH_SERVICE_URL },
    { name: 'wallet', prefixes: WALLET_PROXY_PREFIXES, target: env.WALLET_SERVICE_URL },
    {
      name: 'blockchain',
      prefixes: BLOCKCHAIN_PROXY_PREFIXES,
      target: env.BLOCKCHAIN_SERVICE_URL,
    },
    { name: 'payments', prefixes: PAYMENTS_PROXY_PREFIXES, target: env.PAYMENTS_SERVICE_URL },
    {
      name: 'compliance',
      prefixes: COMPLIANCE_PROXY_PREFIXES,
      target: env.COMPLIANCE_SERVICE_URL,
    },
    { name: 'custody', prefixes: CUSTODY_PROXY_PREFIXES, target: env.CUSTODY_SERVICE_URL },
    {
      name: 'notifications',
      prefixes: NOTIFICATIONS_PROXY_PREFIXES,
      target: env.NOTIFICATIONS_SERVICE_URL,
    },
    { name: 'analytics', prefixes: ANALYTICS_PROXY_PREFIXES, target: env.ANALYTICS_SERVICE_URL },
    { name: 'ai', prefixes: AI_PROXY_PREFIXES, target: env.AI_SERVICE_URL },
    {
      name: 'observability',
      prefixes: OBSERVABILITY_PROXY_PREFIXES,
      target: env.OBSERVABILITY_SERVICE_URL,
    },
    {
      name: 'market-data',
      prefixes: MARKET_DATA_PROXY_PREFIXES,
      target: env.MARKET_DATA_SERVICE_URL,
    },
    { name: 'swap', prefixes: SWAP_PROXY_PREFIXES, target: env.SWAP_SERVICE_URL },
    { name: 'staking', prefixes: STAKING_PROXY_PREFIXES, target: env.STAKING_SERVICE_URL },
    {
      name: 'connections',
      prefixes: CONNECTIONS_PROXY_PREFIXES,
      target: env.CONNECTIONS_SERVICE_URL,
    },
    { name: 'bridge', prefixes: BRIDGE_PROXY_PREFIXES, target: env.BRIDGE_SERVICE_URL },
  ].map((route) => ({ ...route, target: route.target?.replace(/\/$/, '') }));

  const timeoutMs = getProxyTimeoutMs();

  const proxy = createProxyMiddleware({
    // Fallback only — router always selects a real target for filtered paths.
    target: env.AUTH_SERVICE_URL.replace(/\/$/, ''),
    changeOrigin: true,
    pathFilter: (pathname) => routes.some((route) => matchesPrefix(pathname, route.prefixes)),
    router: (req) => {
      const pathname = pathnameOf(req.url);
      const route = routes.find((candidate) => matchesPrefix(pathname, candidate.prefixes));
      return route?.target;
    },
    timeout: timeoutMs,
    proxyTimeout: timeoutMs,
    on: {
      proxyReq: (proxyReq, req) => {
        fixRequestBody(proxyReq, req);
        hardenProxyRequest(proxyReq, req);
      },
      proxyRes: (proxyRes, req) => {
        applyGatewayBrowserHeaders(proxyRes, req, env.CORS_ORIGINS);
      },
    },
  });

  const handler: RequestHandler = (req, res, next) => {
    const pathname = pathnameOf(req.url);
    const route = routes.find((candidate) => matchesPrefix(pathname, candidate.prefixes));
    if (route && !route.target) {
      res.status(503).json({
        error: 'service_unavailable',
        message: `${route.name} is not configured on this gateway`,
      });
      return;
    }
    return proxy(req, res, next);
  };
  return handler;
}
