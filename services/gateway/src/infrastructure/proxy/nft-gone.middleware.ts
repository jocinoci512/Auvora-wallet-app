import type { NextFunction, Request, RequestHandler, Response } from 'express';

const GONE_PREFIXES = ['/api/v1/nfts', '/api/v1/admin/nfts'] as const;

function matchesGone(path: string): boolean {
  return GONE_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
}

/** NFT product line permanently removed — callers get 410 Gone. */
export function createNftGoneMiddleware(): RequestHandler {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!matchesGone(req.path)) {
      next();
      return;
    }
    res.status(410).json({
      error: 'gone',
      message: 'NFT APIs have been permanently removed from Auvora Wallet.',
    });
  };
}
