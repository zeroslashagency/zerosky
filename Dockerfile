# Zerosky — Multi-stage Dockerfile for pos-web (Next.js + tRPC API)
# The API is served by Next.js at /api/trpc, not a standalone server.

# Stage 1: Dependencies — BuildKit cache keeps npm tarballs across builds (+60-120s saved).
FROM node:22-alpine AS deps
WORKDIR /app

# Copy workspace manifests
COPY package*.json ./
COPY turbo.json ./
COPY tsconfig.base.json ./

# Copy all package manifests (cache key: package.json content)
COPY packages/database/package*.json ./packages/database/
COPY packages/auth/package*.json ./packages/auth/
COPY packages/api/package*.json ./packages/api/
COPY packages/payments/package*.json ./packages/payments/
COPY packages/print/package*.json ./packages/print/
COPY packages/offline/package*.json ./packages/offline/
COPY packages/ui/package*.json ./packages/ui/
COPY apps/kds-display/package*.json ./apps/kds-display/
COPY apps/pos-web/package*.json ./apps/pos-web/

# Install with npm cache mounted — no re-download on source-only changes.
RUN --mount=type=cache,target=/root/.npm npm ci

# Stage 2: Build
FROM node:22-alpine AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/package*.json ./
COPY --from=deps /app/turbo.json ./
COPY --from=deps /app/tsconfig.base.json ./

# Copy source (layer invalidates on source change — unavoidable, but deps layer above stays cached)
COPY packages ./packages
COPY apps/pos-web ./apps/pos-web
COPY apps/kds-display ./apps/kds-display

# Generate both Prisma clients in parallel, then build via turbo
RUN npx prisma generate --schema packages/database/prisma/schema.prisma & \
    npx prisma generate --schema packages/offline/prisma/schema.prisma & \
    wait
RUN npm run build

# Stage 3: Production runtime — lean, uses standalone (200-300MB smaller)
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN apk add --no-cache openssl

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Standalone is the pruned server + minimal node_modules (next-trace). Static + public always needed.
COPY --from=builder /app/apps/pos-web/.next/standalone ./
COPY --from=builder /app/apps/pos-web/.next/static ./apps/pos-web/.next/static
COPY --from=builder /app/apps/pos-web/public ./apps/pos-web/public
# Prisma CLI + schema for `migrate deploy` at boot — only the binary + schema, not full node_modules.
COPY --from=builder /app/node_modules/.bin/prisma ./node_modules/.bin/prisma
COPY --from=builder /app/node_modules/prisma ./node_modules/prisma
COPY --from=builder /app/packages/database/prisma ./packages/database/prisma
COPY --from=builder /app/packages/database/generated ./packages/database/generated
COPY entrypoint.sh ./entrypoint.sh
RUN chmod +x ./entrypoint.sh && chown -R nextjs:nodejs /app

USER nextjs
EXPOSE 3000
ENV PORT=3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "const p=process.env.PORT||3000;fetch('http://localhost:'+p+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["./entrypoint.sh"]
