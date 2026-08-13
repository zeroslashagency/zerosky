# Architecture — Zerosky layers (public clean)

## Layers

```
Presentation (apps/)
  pos-web (Next App Router, /api/trpc route, middleware auth gate)
  kds-display (Next, PIN login, default-deny)
  mobile (Flutter, waiter app)
      ↓ tRPC client (superjson) + httpOnly cookie
Business (packages/api)
  routers/* (order, kot, table, payment, shift, menu, inventory, reports)
  context.ts (JWT+Redis session resolver)  trpc.ts (public/protected/roleProcedure + rate limit)
      ↓ Prisma
Data (packages/database)
  prisma/schema.prisma (Tenant→Branch→Order→KOT→Payment→Shift)
  adapters: offline (SQLite mirror, experimental), print (ESC/POS), payments (Razorpay)
Cross-cutting: packages/auth (jwt, session, rbac), packages/ui (tokens)
```

## Dependency injection

- `createContext({ db, resolver, auth })` — inject Prisma + UserResolver + AuthUser for tests.
- `SessionManager(redis)` — inject RedisLike (ioredis or in-memory) — no global.
- `createInMemoryRateLimiter` — swappable via `setRateLimiter` (not global singleton).

## Extension points

- `IFileStorage`/`INotification` not yet — future: `offline` sync adapter, `print` transport (`mock`→`network`→`usb`), `payments` provider (Razorpay → others) via Strategy.

## SOLID check

- SRP: each router one domain, each package one responsibility — PASS
- O/C: `roleProcedure(...roles)` open for new roles — PASS
- DIP: routers depend on `Context` interface, not `PrismaClient` concrete — PASS

## Public clean

- `apps/mobile-app` removed (duplicate RN), keep Flutter
- `offline/print/payments` marked experimental, 0 imports — not breaking public build
- `team/` kept as orchestration example, no secrets, Hetzner IP scrubbed
