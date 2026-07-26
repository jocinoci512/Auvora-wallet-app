import type { RequestHandler } from 'express';

/**
 * Explicitly deny public access to service-internal routes.
 * Downstream services also require x-internal-api-key; this is defense-in-depth
 * so internal paths never transit the public gateway even if a proxy filter slips.
 */
export function createInternalRouteDenyMiddleware(): RequestHandler {
  return (req, res, next) => {
    const path = req.path ?? req.url ?? '';
    if (path === '/api/v1/internal' || path.startsWith('/api/v1/internal/')) {
      res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Internal service routes are not available through the gateway',
        },
      });
      return;
    }
    next();
  };
}
