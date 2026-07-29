import type { RequestHandler } from 'express';
import helmet from 'helmet';
import { CONTENT_SECURITY_POLICY_RECOMMENDED, SECURITY_HEADERS } from '@auvora/security';

/**
 * Edge security headers. Enforced CSP remains deferred to TLS ingress / GA.
 * RC1 emits Content-Security-Policy-Report-Only so violations can be observed safely.
 * Prefer HSTS at the TLS terminator; set enableHsts=false when ingress already sends it.
 */
export function createSecurityHeadersMiddleware(options?: {
  /** Prefer enabling HSTS at the TLS terminator/ingress; set false when edge already sends HSTS. */
  enableHsts?: boolean;
}): RequestHandler[] {
  const enableHsts = options?.enableHsts ?? process.env['NODE_ENV'] === 'production';
  return [
    helmet({
      // Enforced CSP deferred — report-only header applied below.
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
      res.setHeader('Content-Security-Policy-Report-Only', CONTENT_SECURITY_POLICY_RECOMMENDED);
      next();
    },
  ];
}
