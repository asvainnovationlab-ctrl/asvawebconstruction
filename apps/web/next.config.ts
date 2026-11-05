import { existsSync } from 'node:fs';
import path from 'node:path';
import { config } from 'dotenv';
import type { NextConfig } from 'next';

// Local development reads the monorepo root .env; production uses real environment variables.
const rootEnv = path.resolve(process.cwd(), '../../.env');
if (existsSync(rootEnv)) config({ path: rootEnv, quiet: true });

const apiUrl = (process.env.API_INTERNAL_URL ?? 'http://localhost:4000').replace(/\/$/, '');

/** Optional CDN/object-storage host for media (STORAGE_PUBLIC_URL on the API). */
const mediaHost = process.env.STORAGE_PUBLIC_URL ? new URL(process.env.STORAGE_PUBLIC_URL) : null;

const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), browsing-topics=()' },
  ...(process.env.NODE_ENV === 'production' ? [{ key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' }] : []),
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  output: 'standalone',
  outputFileTracingRoot: path.resolve(process.cwd(), '../..'),
  transpilePackages: ['@asva/shared'],
  images: {
    formats: ['image/avif', 'image/webp'],
    localPatterns: [{ pathname: '/api/v1/media/files/**', search: '' }, { pathname: '/brand/**', search: '' }, { pathname: '/images/**', search: '' }],
    remotePatterns: mediaHost ? [{ protocol: mediaHost.protocol.replace(':', '') as 'https' | 'http', hostname: mediaHost.hostname, pathname: `${mediaHost.pathname.replace(/\/$/, '')}/**` }] : [],
  },
  async rewrites() {
    // The browser only talks to this origin; API calls are proxied so auth cookies stay first-party.
    return [{ source: '/api/v1/:path*', destination: `${apiUrl}/api/v1/:path*` }];
  },
  async headers() {
    return [
      { source: '/:path*', headers: securityHeaders },
      { source: '/admin/:path*', headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }, { key: 'Cache-Control', value: 'no-store' }] },
    ];
  },
};

export default nextConfig;
