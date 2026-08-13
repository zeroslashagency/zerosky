#!/bin/sh
set -e
# Run migrations before starting Next.js. Idempotent — safe on every boot.
echo "[entrypoint] prisma migrate deploy"
npx --prefix packages/database prisma migrate deploy
echo "[entrypoint] starting Next.js"
exec node apps/pos-web/server.js
