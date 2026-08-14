# Development Guide

## Prerequisites

- **Node.js** >= 22
- **npm** >= 10 (enforced by `packageManager` field in root `package.json`)
- **Docker** (for local Postgres + Redis)

## Initial setup

```bash
# Install dependencies
npm install

# Start database containers
cd packages/database
docker compose up -d

# Apply schema
npx prisma migrate deploy

# Seed dev data
npx tsx prisma/seed.ts

cd ../..
```

## Running the dev server

```bash
# From repo root: starts all apps in parallel
npm run dev
```

This runs Turborepo's `dev` task across the workspace:
- `apps/pos-web` → http://localhost:3000 (POS terminal)
- `apps/kds-display` → http://localhost:3002 (Kitchen Display)

The tRPC API is served from `apps/pos-web/app/api/trpc/[trpc]/route.ts` at `/api/trpc`.

## Important: --webpack flag

**Next.js 16 defaults to Turbopack, but our `next.config.ts` has a webpack `extensionAlias` config** to resolve `.js` imports to `.ts` files in ESM packages (`@zerosky/api`, `@zerosky/auth`, `@zerosky/database`).

Without this, imports fail with "Module not found".

**Both `dev` and `build` scripts already pass `--webpack`** in `apps/pos-web/package.json`:

```json
{
  "scripts": {
    "dev": "next dev --webpack",
    "build": "next build --webpack"
  }
}
```

If you run Next.js commands manually, always add `--webpack`.

## Database workflows

### Migrations

```bash
cd packages/database

# Create a new migration (dev)
npx prisma migrate dev --name add_column_xyz

# Apply migrations (prod)
npx prisma migrate deploy

# Reset database (drops all data)
npx prisma migrate reset
```

### Seed data

```bash
cd packages/database
npx tsx prisma/seed.ts
```

**Seed credentials (from `prisma/seed.ts`):**
- Tenant slug: `zerosky-demo`
- Password: `zerosky123` (override via `SEED_PASSWORD` env var)
- Users:
  - `owner@zerosky.dev` (PIN: `1111`, role: OWNER)
  - `manager@zerosky.dev` (PIN: `2222`, role: MANAGER)
  - `cashier@zerosky.dev` (PIN: `3333`, role: CASHIER)
  - `waiter@zerosky.dev` (PIN: `4444`, role: WAITER)
  - `kitchen@zerosky.dev` (PIN: `5555`, role: KITCHEN)

### Prisma Studio

```bash
cd packages/database
npx prisma studio
```

Opens a web UI at http://localhost:5555 to browse and edit data.

## Testing

```bash
# Run all tests
npm run test

# Run tests for a specific package
cd packages/api
npm run test

# Watch mode
npm run test -- --watch

# Coverage
npm run test -- --coverage
```

Test framework: **Vitest**

Packages with test coverage:
- `packages/api` (tRPC routers, auth, rate limiting)
- `packages/auth` (bcrypt, JWT, sessions, RBAC)
- `packages/payments` (Razorpay, multi-tender, reconciliation)
- `packages/offline` (SQLite sync queue)
- `packages/print` (ESC/POS rendering)
- `packages/ui` (palette logic + WCAG contrast assertions over theme.css)

## End-to-end tests

Playwright specs live in `e2e/` (config: `playwright.config.ts`). They cover
the auth/middleware redirect, the critical money path (menu → modifier modal →
order → KOT → payment → dashboard revenue), theme + palette persistence, and an
axe-core WCAG 2 AA smoke check in light and dark mode.

The suite drives `apps/pos-web` on `http://localhost:3000`. `webServer` in the
config starts the dev server automatically with `reuseExistingServer: true`, so
an already-running server on that port is reused. The specs authenticate with
the seeded `cashier@zerosky.dev` account, so the database must be seeded first.

```bash
# One-time: install the browser
npx playwright install chromium

# Seed data the specs depend on (modifier groups, tables, users)
cd packages/database && npm run db:seed && cd ../..

# Run headless (starts pos-web on :3000 if not already running)
npm run test:e2e

# Interactive UI / headed variants
npm run test:e2e:ui
npm run test:e2e:headed
```

In CI, provision Postgres + Redis, run `prisma migrate deploy`
then `db:seed`, install Playwright with system deps
(`npx playwright install --with-deps chromium`), and run `npm run test:e2e`.

## Linting & type checking

```bash
# Lint all packages
npm run lint

# Type-check all packages
npm run typecheck
```

ESLint config: `eslint-config-next` (apps), default for packages.

## Environment variables

### `apps/pos-web/.env.local`

```env
NEXT_PUBLIC_API_URL=http://localhost:3000/api/trpc
NEXT_PUBLIC_TENANT_SLUG=zerosky-demo

DATABASE_URL=postgresql://zerosky:zerosky@localhost:5432/zerosky?schema=public
REDIS_URL=redis://localhost:6379
```

### `packages/database/.env`

```env
DATABASE_URL=postgresql://zerosky:zerosky@localhost:5432/zerosky?schema=public
REDIS_URL=redis://localhost:6379
```

**Do not commit real secrets.** The dev credentials above are safe to commit because they're only valid for local Docker containers.

## Turborepo caching

Turborepo caches task outputs (build artifacts, test results) in `.turbo/cache/`.

```bash
# Clear Turbo cache
rm -rf .turbo

# Run without cache
npx turbo run build --force
```

## Gotchas

### 1. pnpm fails even though workspace uses npm

**Why:** The root `package.json` has `"packageManager": "npm@10.8.2"`, which Corepack enforces. Running `pnpm install` or `pnpm --filter` errors out.

**Fix:** Use `npm` for all operations. This is intentional — the repo standardized on npm.

### 2. Dev server hot-reload is slow

**Why:** Next.js 16 Turbopack was disabled in favor of webpack for `extensionAlias` support. Webpack is slower in dev.

**Future:** Once `extensionAlias` is supported in Turbopack, remove the `webpack: (config) => { ... }` block from `next.config.ts` and drop `--webpack` from scripts.

### 3. Rate limit 429 on localhost

**Why:** The in-memory rate limiter uses `clientId` derived from the auth token or IP. On localhost with no reverse proxy, all requests fall back to `"anonymous"`, so the entire dev session shares one bucket.

**Fix:** The default limit is 1,000 req/min, which is generous. If you still hit 429:
- Log in (authenticated users get a per-user bucket: `user:<userId>`)
- Raise the limit: `export API_RATE_LIMIT=10000` before `npm run dev`

### 4. Prisma client out of sync

**Symptoms:** Import errors like `Property 'xyz' does not exist on type 'PrismaClient'`.

**Fix:**
```bash
cd packages/database
npx prisma generate
cd ../..
npm run typecheck
```

Turborepo's `db:generate` task should handle this automatically, but manual regeneration helps after schema changes.

## Debugging

### Server logs

Turborepo streams logs from all apps. To see only one:

```bash
cd apps/pos-web
npm run dev
```

### tRPC requests

tRPC middleware logs every request to `console.info`:

```json
{
  "requestId": "req_abc123",
  "path": "order.list",
  "type": "query",
  "ok": true,
  "durationMs": 12,
  "userId": "user_xyz",
  "tenantId": "tenant_abc"
}
```

Errors log to `console.error` with stack traces.

### Database queries

Enable Prisma query logging:

```bash
export DEBUG="prisma:query"
npm run dev
```

### React Query Devtools

Already enabled in `apps/pos-web/app/providers.tsx`:

```tsx
<ReactQueryDevtools initialIsOpen={false} />
```

Open the devtools panel in the browser to inspect tRPC query cache.

## Adding a new package

```bash
mkdir -p packages/my-package/src
cd packages/my-package

# Create package.json
npm init -y

# Add TypeScript
npm install --save-dev typescript
npx tsc --init

# Add to workspace (already covered by "packages/*" glob in root package.json)
```

Then add a `build` script and `exports` field to `package.json` so other packages can import it.

## Adding a new app

```bash
cd apps
npx create-next-app@latest my-app --typescript --tailwind --app --no-turbopack

# Add tRPC + Prisma dependencies
cd my-app
npm install @trpc/client @trpc/server @trpc/react-query @tanstack/react-query superjson
npm install @zerosky/api @zerosky/database @zerosky/auth
```

## Recommended VS Code extensions

- **Prisma** (prisma.prisma)
- **ESLint** (dbaeumer.vscode-eslint)
- **Tailwind CSS IntelliSense** (bradlc.vscode-tailwindcss)
- **Pretty TypeScript Errors** (yoavbls.pretty-ts-errors)
