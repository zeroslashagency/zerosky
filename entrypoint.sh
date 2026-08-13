#!/bin/sh
set -e
# Run migrations before starting Next.js. Idempotent — safe on every boot.
echo "[entrypoint] prisma migrate deploy"
npx prisma migrate deploy --schema=packages/database/prisma/schema.prisma
echo "[entrypoint] prisma seed check (optional)"
# Seed only if tables are empty — seed.ts is idempotent but avoid extra work
# Ignore failure (e.g. already seeded)
npx tsx packages/database/prisma/seed.ts 2>&1 | head -50 || true
echo "[entrypoint] starting Next.js"
exec node apps/pos-web/server.js
