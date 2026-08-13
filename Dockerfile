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

# Copy source for all packages
COPY packages ./packages
COPY apps/pos-web ./apps/pos-web

# Generate Prisma client
RUN cd packages/database && npx prisma generate

# Build pos-web (includes API)
# IMPORTANT: --webpack flag is required (see next.config.ts)
RUN cd apps/pos-web && npm run build

# Stage 3: Production runtime
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

# Create non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copy workspace config
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/turbo.json ./
COPY --from=builder /app/tsconfig.base.json ./

# Copy packages (needed at runtime for imports)
COPY --from=builder /app/packages ./packages

# Copy built Next.js app
COPY --from=builder /app/apps/pos-web/.next ./apps/pos-web/.next
COPY --from=builder /app/apps/pos-web/package*.json ./apps/pos-web/
COPY --from=builder /app/apps/pos-web/public ./apps/pos-web/public

# Install production dependencies
RUN npm ci --omit=dev && npm cache clean --force

# Regenerate Prisma client in prod deps
RUN cd packages/database && npx prisma generate

# Next.js collects anonymous telemetry. Disable it.
ENV NEXT_TELEMETRY_DISABLED=1

# Change ownership to nextjs user
RUN chown -R nextjs:nodejs /app

USER nextjs

# Expose port
EXPOSE 3000

ENV PORT=3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "fetch('http://localhost:3000/api/trpc/auth.me').catch(() => process.exit(1))"

# Start Next.js
CMD ["sh", "-c", "cd apps/pos-web && npm start"]
