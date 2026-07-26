import type { RequestHandler } from 'express';
import helmet from 'helmet';
import { SECURITY_HEADERS } from '@auvora/security';

export function createSecurityHeadersMiddleware(options?: {
  enableHsts?: boolean;
}): RequestHandler[] {
  const enableHsts = options?.enableHsts ?? process.env['NODE_ENV'] === 'production';
  return [
    helmet({
      contentSecurityPolicy: false,
      xContentTypeOptions: SECURITY_HEADERS.contentTypeOptions === 'nosniff',
      frameguard: { action: SECURITY_HEADERS.frameOptions === 'DENY' ? 'deny' : 'sameorigin' },
      referrerPolicy: { policy: SECURITY_HEADERS.referrerPolicy as 'no-referrer' },
      crossOriginOpenerPolicy: { policy: 'same-origin' },
      crossOriginResourcePolicy: { policy: 'same-site' },
      hsts: enableHsts ? { maxAge: 31536000, includeSubDomains: true, preload: false } : false,
    }),
    (_req, res, next) => {
      res.setHeader('Permissions-Policy', SECURITY_HEADERS.permissionsPolicy);
      res.setHeader('X-XSS-Protection', SECURITY_HEADERS.xssProtection);
      next();
    },
  ];
}
