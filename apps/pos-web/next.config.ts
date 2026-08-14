import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // standalone for Docker/Hetzner — Vercel ignores this and uses its own output
  output: 'standalone',
  transpilePackages: ['@zerosky/api', '@zerosky/auth', '@zerosky/database'],
  // Tree-shake barrel imports — saves ~30kb + avoids pulling whole react-query.
  experimental: {
    optimizePackageImports: ['lucide-react', '@zerosky/ui', '@tanstack/react-query', 'superjson'],
  },
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production' ? { exclude: ['error', 'warn'] } : false,
  },
  // Prisma engine for Vercel rhel-openssl-3.0.x — must trace libquery_engine.so.node
  // Path is relative to apps/pos-web, so ../../packages is correct. Also include offline.
  outputFileTracingIncludes: {
    '/api/**/*': ['../../packages/database/generated/client/**/*', '../../packages/offline/generated/client/**/*'],
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
              "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://checkout.razorpay.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https://images.unsplash.com https://picsum.photos; connect-src 'self' https://checkout.razorpay.com https://api.razorpay.com",
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
