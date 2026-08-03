import type { NextConfig } from 'next';

const isProd = process.env.NODE_ENV === 'production';

/**
 * Aligned with @auvora/security SECURITY_HEADERS (minus HSTS — TLS terminator only).
 * CSP is Report-Only in RC1 (matches CONTENT_SECURITY_POLICY_RECOMMENDED); enforce at edge/GA.
 * Dev CSP omits frame-ancestors 'none' so Cursor/IDE Simple Browser previews can embed.
 */
const CONTENT_SECURITY_POLICY_REPORT_ONLY = isProd
  ? "default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; form-action 'self'; img-src 'self' data: blob: https:; media-src 'self' blob: https:; font-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; connect-src 'self' https: wss:;"
  : "default-src 'self'; base-uri 'self'; object-src 'none'; form-action 'self'; img-src 'self' data: blob: https:; media-src 'self' blob: https:; font-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; connect-src 'self' http: https: ws: wss:;";

const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  // Production only — X-Frame-Options blocks Cursor/IDE embedded previews (cross-origin iframe).
  ...(isProd ? [{ key: 'X-Frame-Options', value: 'DENY' }] : []),
  // HSTS also expected at TLS edge (Vercel); emit in prod builds as defense in depth.
  ...(isProd
    ? [{ key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' }]
    : []),
  { key: 'Referrer-Policy', value: 'no-referrer' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
  { key: 'X-XSS-Protection', value: '0' },
  { key: 'Cross-Origin-Opener-Policy', value: isProd ? 'same-origin' : 'unsafe-none' },
  { key: 'Cross-Origin-Resource-Policy', value: isProd ? 'same-site' : 'cross-origin' },
  { key: 'X-DNS-Prefetch-Control', value: 'on' },
  { key: 'Content-Security-Policy-Report-Only', value: CONTENT_SECURITY_POLICY_REPORT_ONLY },
];

const nextConfig: NextConfig = {
  // Allow both localhost and 127.0.0.1 (and Cursor tunnel hosts) to hit the dev server.
  allowedDevOrigins: ['127.0.0.1', 'localhost', '*.localhost'],
  transpilePackages: ['@auvora/ui', '@auvora/sdk', '@auvora/types'],
  ...(process.env['DOCKER_BUILD'] === 'true' ? { output: 'standalone' as const } : {}),
  poweredByHeader: false,
  reactStrictMode: true,
  compress: true,
  experimental: {
    optimizePackageImports: ['@auvora/ui', '@auvora/sdk'],
  },
  images: {
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    minimumCacheTTL: 60 * 60 * 24,
    remotePatterns: [
      { protocol: 'https', hostname: '**.alchemy.com' },
      { protocol: 'https', hostname: '**.nftstorage.link' },
      { protocol: 'https', hostname: 'ipfs.io' },
      { protocol: 'https', hostname: '**.cloudflare-ipfs.com' },
      { protocol: 'https', hostname: 'arweave.net' },
    ],
  },
  async redirects() {
    return [];
  },
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  },
};

export default nextConfig;
