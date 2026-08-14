#!/bin/bash
set -e
echo "[vercel] prisma generate (parallel)"
npx prisma generate --schema packages/database/prisma/schema.prisma & 
npx prisma generate --schema packages/offline/prisma/schema.prisma & 
wait
echo "[vercel] copy prisma engine for Next tracing"
mkdir -p apps/pos-web/generated/client apps/kds-display/generated/client
cp packages/database/generated/client/libquery_engine* apps/pos-web/generated/client/ 2>/dev/null || true
cp packages/database/generated/client/libquery_engine* apps/kds-display/generated/client/ 2>/dev/null || true
echo "[vercel] turbo build"
npm run build
