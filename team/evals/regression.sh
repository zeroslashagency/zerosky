#!/bin/bash
set -e
echo "=== Zerosky Regression (slice) ==="
if command -v docker >/dev/null 2>&1; then
  echo "docker compose config (prod)..."
  POSTGRES_USER=test POSTGRES_PASSWORD=test POSTGRES_DB=test REDIS_PASSWORD=test JWT_SECRET=$(openssl rand -hex 32 2>/dev/null || echo "test-jwt-secret-32-chars-long-enough-1234") NEXT_PUBLIC_API_URL=/api/trpc NEXT_PUBLIC_TENANT_SLUG=zerosky-demo docker compose -f docker-compose.prod.yml config >/dev/null && echo "PASS: prod compose config" || echo "FAIL: prod compose config"
else
  echo "SKIP: docker not available"
fi
echo "=== Regression done ==="
