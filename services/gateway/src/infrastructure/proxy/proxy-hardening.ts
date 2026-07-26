import type { IncomingMessage } from 'node:http';
import type { ClientRequest } from 'node:http';

/**
 * Harden proxied requests: overwrite X-Forwarded-For with the connecting IP
 * (never preserve client-supplied hops) and strip internal service headers.
 */
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
}
