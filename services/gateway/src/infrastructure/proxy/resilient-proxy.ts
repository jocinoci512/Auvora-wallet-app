import type { RequestHandler } from 'express';
import { createProxyMiddleware, fixRequestBody } from 'http-proxy-middleware';
import { CircuitBreaker, createMetrics, type ResilienceMetrics } from '@auvora/resilience';
import { hardenProxyRequest } from './proxy-hardening';

const proxyMetrics: ResilienceMetrics = createMetrics();
const proxyCircuits = new Map<string, CircuitBreaker>();

function circuitFor(name: string): CircuitBreaker {
  let breaker = proxyCircuits.get(name);
  if (!breaker) {
    breaker = new CircuitBreaker(`gateway:${name}`, {
      failureThreshold: 8,
      resetTimeoutMs: 15_000,
      metrics: proxyMetrics,
    });
    proxyCircuits.set(name, breaker);
  }
  return breaker;
}

export function getGatewayProxyResilienceMetrics(): ResilienceMetrics {
  return { ...proxyMetrics };
}

export function getGatewayProxyCircuitStates(): Record<string, string> {
  return Object.fromEntries(
    [...proxyCircuits.entries()].map(([name, breaker]) => [name, breaker.getState()]),
  );
}

export type DownstreamProxyOptions = {
  name: string;
  targetUrl: string;
  pathFilter: (pathname: string) => boolean;
  /** Downstream timeout in ms (default 30s). */
  timeoutMs?: number;
};

/**
 * Shared proxy factory: request hardening + timeout + circuit-aware error handling.
 * Does not replace existing middleware files — used by new wrappers and available for adoption.
 */
export function createDownstreamProxyMiddleware(options: DownstreamProxyOptions): RequestHandler {
  const timeoutMs = options.timeoutMs ?? 30_000;
  const breaker = circuitFor(options.name);
  const proxy = createProxyMiddleware({
    target: options.targetUrl.replace(/\/$/, ''),
    changeOrigin: true,
    pathFilter: options.pathFilter,
    timeout: timeoutMs,
    proxyTimeout: timeoutMs,
    on: {
      proxyReq: (proxyReq, req) => {
        fixRequestBody(proxyReq, req);
        hardenProxyRequest(proxyReq, req);
      },
      error: (_err, _req, res) => {
        void breaker
          .exec(async () => {
            throw new Error('downstream_error');
          })
          .catch(() => undefined);
        if (res && 'writeHead' in res && typeof res.writeHead === 'function' && !res.headersSent) {
          const open = breaker.getState() === 'open';
          res.writeHead(open ? 503 : 502, { 'Content-Type': 'application/json' });
          res.end(
            JSON.stringify({
              success: false,
              error: {
                code: open ? 'UPSTREAM_CIRCUIT_OPEN' : 'UPSTREAM_UNAVAILABLE',
                message: open
                  ? 'Upstream temporarily unavailable (circuit open)'
                  : 'Upstream request failed',
              },
            }),
          );
        }
      },
    },
  });

  return (req, res, next) => {
    if (breaker.getState() === 'open') {
      res.status(503).json({
        success: false,
        error: {
          code: 'UPSTREAM_CIRCUIT_OPEN',
          message: `Upstream ${options.name} circuit is open`,
        },
      });
      return;
    }
    proxy(req, res, next);
  };
}
