import type { RequestHandler } from 'express';

const AUTH_SESSION_PREFIXES = [
  '/api/v1/admin/users',
  '/api/v1/admin/audit',
  '/api/v1/admin/operators',
  '/api/v1/admin/realtime',
] as const;

function pathnameOf(url: string | undefined): string {
  if (!url) return '';
  const q = url.indexOf('?');
  return q === -1 ? url : url.slice(0, q);
}

function isAuthHandledAdminPath(pathname: string): boolean {
  return AUTH_SESSION_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

/**
 * Non-auth Admin mutations (wallet/connections/…) only see a signed JWT unless
 * we re-check the live Admin session. Auth-owned Admin routes already do that
 * in JwtStrategy. Safe GET reads may continue until access-token TTL.
 */
export function createAdminLiveSessionMiddleware(authServiceUrl: string): RequestHandler {
  const sessionUrl = `${authServiceUrl.replace(/\/$/, '')}/api/v1/auth/admin/session`;
  return (req, res, next) => {
    const pathname = pathnameOf(req.originalUrl || req.url);
    if (!pathname.startsWith('/api/v1/admin')) {
      next();
      return;
    }
    if (isAuthHandledAdminPath(pathname)) {
      next();
      return;
    }
    const method = (req.method || 'GET').toUpperCase();
    if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') {
      next();
      return;
    }

    const headers: Record<string, string> = { Accept: 'application/json' };
    if (typeof req.headers.cookie === 'string') {
      headers.cookie = req.headers.cookie;
    }
    if (typeof req.headers.authorization === 'string') {
      headers.authorization = req.headers.authorization;
    }

    void fetch(sessionUrl, { method: 'GET', headers })
      .then((response) => {
        if (response.ok) {
          next();
          return;
        }
        res.status(401).json({
          success: false,
          error: { message: 'Session revoked or expired' },
        });
      })
      .catch(() => {
        res.status(503).json({
          success: false,
          error: { message: 'Session verification unavailable' },
        });
      });
  };
}
