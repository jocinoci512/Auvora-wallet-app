import type { RequestHandler } from 'express';
import helmet from 'helmet';
import { SECURITY_HEADERS } from '@auvora/security';

export function createSecurityHeadersMiddleware(): RequestHandler[] {
  return [
    helmet({
      contentSecurityPolicy: false,
      xContentTypeOptions: SECURITY_HEADERS.contentTypeOptions === 'nosniff',
      frameguard: { action: SECURITY_HEADERS.frameOptions === 'DENY' ? 'deny' : 'sameorigin' },
      referrerPolicy: { policy: SECURITY_HEADERS.referrerPolicy as 'no-referrer' },
    }),
    (_req, res, next) => {
      res.setHeader('Permissions-Policy', SECURITY_HEADERS.permissionsPolicy);
      next();
    },
  ];
}
