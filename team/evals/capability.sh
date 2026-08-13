#!/bin/bash
set -e
echo "=== Zerosky S1 Capability ==="
echo "Check 1: .dockerignore migrations not excluded"
if grep -q "prisma/migrations.*migration.sql" .dockerignore; then echo "FAIL: migrations still excluded"; exit 1; else echo "PASS: migrations included"; fi
echo "Check 2: vercel.json exists"
test -f vercel.json && echo "PASS: vercel.json" || (echo "FAIL: vercel.json missing"; exit 1)
echo "Check 3: next.config standalone"
grep -q "output.*standalone" apps/pos-web/next.config.ts && echo "PASS: standalone" || (echo "FAIL: standalone missing"; exit 1)
echo "Check 4: Dockerfile entrypoint"
grep -q "entrypoint.sh" Dockerfile && echo "PASS: entrypoint" || (echo "FAIL: entrypoint"; exit 1)
echo "Check 5: pgbouncer in prod compose"
grep -q "pgbouncer" docker-compose.prod.yml && echo "PASS: pgbouncer" || (echo "FAIL: pgbouncer"; exit 1)
echo "Check 6: healthcheck 401"
grep -q "401" Dockerfile && echo "PASS: healthcheck 401" || (echo "FAIL: healthcheck"; exit 1)
echo "=== S1 Capability PASS ==="
