#!/bin/sh
set -e
# Run migrations before starting Next.js. Idempotent — safe on every boot.
echo "[entrypoint] prisma migrate deploy"
npx prisma migrate deploy --schema=packages/database/prisma/schema.prisma
if [ "${SEED_ON_BOOT:-false}" = "true" ]; then
  if [ "${NODE_ENV:-}" = "production" ] && [ "${ALLOW_DESTRUCTIVE_SEED:-false}" != "true" ]; then
    echo "[entrypoint] SEED_ON_BOOT=true but ALLOW_DESTRUCTIVE_SEED!=true — refusing to seed in production" >&2
    exit 1
  fi
  echo "[entrypoint] SEED_ON_BOOT=true — seeding"
  # seed.ts is idempotent; gate behind SEED_ON_BOOT so prod does not reseed every restart
  npx tsx packages/database/prisma/seed.ts 2>&1 | head -50 || true
else
  echo "[entrypoint] skipping seed (set SEED_ON_BOOT=true to enable)"
fi
echo "[entrypoint] starting Next.js"
# standalone server lives at /app/server.js; fallback for non-standalone builds
if [ -f /app/server.js ]; then exec node server.js; else exec node apps/pos-web/server.js; fi
