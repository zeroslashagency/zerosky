# Zerosky — Multi-stage Dockerfile for pos-web (Next.js + tRPC API)
# The API is served by Next.js at /api/trpc, not a standalone server.

# Stage 1: Dependencies
FROM node:22-alpine AS deps
WORKDIR /app

# Copy workspace manifests
COPY package*.json ./
COPY turbo.json ./
COPY tsconfig.base.json ./

# Copy all package manifests
COPY packages/database/package*.json ./packages/database/
COPY packages/auth/package*.json ./packages/auth/
COPY packages/api/package*.json ./packages/api/
COPY packages/payments/package*.json ./packages/payments/
COPY packages/print/package*.json ./packages/print/
COPY packages/offline/package*.json ./packages/offline/
COPY packages/ui/package*.json ./packages/ui/
COPY apps/kds-display/package*.json ./apps/kds-display/
COPY apps/pos-web/package*.json ./apps/pos-web/

# Install dependencies
RUN npm ci

# Stage 2: Build
FROM node:22-alpine AS builder
WORKDIR /app

# Copy dependencies
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/package*.json ./
COPY --from=deps /app/turbo.json ./
COPY --from=deps /app/tsconfig.base.json ./

# Copy source for all packages + both apps
COPY packages ./packages
COPY apps/pos-web ./apps/pos-web
COPY apps/kds-display ./apps/kds-display

# Generate Prisma client
RUN cd packages/database && npx prisma generate

# Build pos-web (includes API) + kds-display
# IMPORTANT: --webpack flag is required (see next.config.ts)
RUN cd apps/pos-web && npm run build
RUN cd apps/kds-display && npm run build

# Stage 3: Production runtime
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

# Alpine needs OpenSSL for Prisma's query engine (linux-musl-openssl-3.0.x)
RUN apk add --no-cache openssl

# Create non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copy workspace config
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/turbo.json ./
COPY --from=builder /app/tsconfig.base.json ./

# Copy node_modules for prisma CLI at runtime
COPY --from=builder /app/node_modules ./node_modules

# Copy packages once (needed at runtime for imports + prisma migrate)
COPY --from=builder /app/packages ./packages

# Copy built Next.js standalone output for pos-web
# With output:'standalone', Next emits apps/pos-web/.next/standalone with minimal server
COPY --from=builder /app/apps/pos-web/.next/standalone ./
COPY --from=builder /app/apps/pos-web/.next/static ./apps/pos-web/.next/static
COPY --from=builder /app/apps/pos-web/public ./apps/pos-web/public
COPY entrypoint.sh ./entrypoint.sh
RUN chmod +x ./entrypoint.sh

# Next.js collects anonymous telemetry. Disable it.
ENV NEXT_TELEMETRY_DISABLED=1

# Change ownership to nextjs user
RUN chown -R nextjs:nodejs /app

USER nextjs

# Expose port
EXPOSE 3000

ENV PORT=3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "const p=process.env.PORT||3000;fetch('http://localhost:'+p+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

# Start via entrypoint (migrate then serve)
CMD ["./entrypoint.sh"]
