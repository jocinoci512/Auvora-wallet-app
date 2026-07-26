/**
 * Harden proxied requests: overwrite X-Forwarded-For with the connecting IP
 * (never preserve client-supplied hops), strip internal service headers, and
 * propagate W3C/distributed-trace correlation headers to downstream services.
 */
import type { IncomingMessage } from 'node:http';
import type { ClientRequest } from 'node:http';

const PROPAGATED_HEADERS = [
  'traceparent',
  'tracestate',
  'x-correlation-id',
  'x-request-id',
  'baggage',
] as const;

export function hardenProxyRequest(
  proxyReq: ClientRequest,
  req: IncomingMessage & { ip?: string; socket: { remoteAddress?: string } },
): void {
  const clientIp = req.ip ?? req.socket.remoteAddress;
  if (clientIp) {
    proxyReq.setHeader('x-forwarded-for', clientIp);
  } else {
    proxyReq.removeHeader('x-forwarded-for');
  }

  proxyReq.removeHeader('x-internal-api-key');

  for (const header of PROPAGATED_HEADERS) {
    const value = req.headers[header];
    if (typeof value === 'string' && value.length > 0) {
      proxyReq.setHeader(header, value);
    } else if (Array.isArray(value) && value[0]) {
      proxyReq.setHeader(header, value[0]);
    }
  }
}
