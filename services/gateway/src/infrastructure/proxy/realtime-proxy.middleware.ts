import type { RequestHandler } from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';
import { hardenProxyRequest } from './proxy-hardening';

/**
 * Admin realtime SSE prefix. Kept OUT of the unified proxy because SSE requires a
 * long-lived, unbuffered, untimed connection — the unified proxy applies a finite
 * proxyTimeout that would sever the stream.
 */
export const REALTIME_PROXY_PREFIXES = ['/api/v1/admin/realtime'] as const;

export function isRealtimeProxyPath(pathname: string): boolean {
  return REALTIME_PROXY_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

/**
 * Dedicated SSE-safe reverse proxy to the auth service realtime endpoint.
 * - timeout/proxyTimeout = 0: never sever a long-lived event stream.
 * - x-internal-api-key stripped by hardenProxyRequest: no browser bypass.
 * - Gateway remains the only public edge; the auth service enforces admin RBAC.
 */
export function createRealtimeProxyMiddleware(authServiceUrl: string): RequestHandler {
  return createProxyMiddleware({
    target: authServiceUrl.replace(/\/$/, ''),
    changeOrigin: true,
    pathFilter: (pathname) => isRealtimeProxyPath(pathname),
    // No timeouts for SSE — the stream is expected to stay open indefinitely.
    timeout: 0,
    proxyTimeout: 0,
    on: {
      proxyReq: (proxyReq, req) => {
        hardenProxyRequest(proxyReq, req);
      },
    },
  });
}
