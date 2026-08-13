import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingIncludes: {
    '/api/**/*': ['../../packages/database/generated/client/**/*', '../../packages/offline/generated/client/**/*'],
  },
  transpilePackages: ['@zerosky/api', '@zerosky/auth', '@zerosky/database'],
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
