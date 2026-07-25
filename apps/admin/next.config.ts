import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@auvora/ui', '@auvora/sdk', '@auvora/types'],
  ...(process.env['DOCKER_BUILD'] === 'true' ? { output: 'standalone' as const } : {}),
  poweredByHeader: false,
  reactStrictMode: true,
};

export default nextConfig;
