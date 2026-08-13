import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // standalone for Docker/Hetzner — Vercel ignores this and uses its own output
  output: 'standalone',
  transpilePackages: ['@zerosky/api', '@zerosky/auth', '@zerosky/database'],
  // Prisma engine for Vercel rhel-openssl-3.0.x — must trace libquery_engine.so.node
  experimental: {
    outputFileTracingIncludes: {
      'app/api/**/*': ['./packages/database/generated/**/*'],
      'app/**/*': ['./packages/database/generated/**/*'],
    },
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          {
            key: 'Content-Security-Policy',
            value:
              "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self'",
          },
        ],
      },
    ];
  },
  webpack: (config) => {
    // Handle .js imports resolving to .ts files in ESM packages
    config.resolve.extensionAlias = {
      '.js': ['.ts', '.tsx', '.js', '.jsx'],
      '.mjs': ['.mts', '.mjs'],
      '.cjs': ['.cts', '.cjs'],
    };
    return config;
  },
};

export default nextConfig;
