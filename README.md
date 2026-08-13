# Zerosky

**Open-source restaurant POS — billing, KOT/KDS, offline-first, India-ready.**

[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](./LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue.svg)](https://www.typescriptlang.org/)

---

Zerosky is a point-of-sale platform for restaurants, covering the full service loop: menu, order, KOT, kitchen display, billing, and payments. Built with an offline-first core so the floor keeps running when the internet doesn't.

Designed for the Indian market: GST billing, UPI payments, and aggregator sync are first-class features.

## What's built

- **Multi-tenant + RBAC** — Owner, Manager, Cashier, Waiter, Kitchen roles with per-tenant isolation
- **Menu management** — Categories, items, modifiers (min/max selection, pricing)
- **Order lifecycle** — OPEN → SENT_TO_KITCHEN → READY → SERVED → BILLED → PAID → CANCELLED
- **KOT/KDS** — Kitchen Order Tickets with station routing and status tracking
- **Payments** — Multi-tender support (cash, card, UPI); Razorpay integration ready
- **Inventory** — Stock tracking, purchase orders, suppliers, adjustments
- **Reports** — Basic sales and shift reconciliation
- **Partnership** — CRUD for franchise/partner records

## Tech stack

| Layer       | Choice                                    |
|-------------|-------------------------------------------|
| Language    | TypeScript                                |
| Monorepo    | Turborepo + npm workspaces                |
| Frontend    | Next.js 16 (App Router) + React + Tailwind |
| API         | tRPC v11 + superjson                      |
| Database    | PostgreSQL 16 + Prisma                    |
| Cache       | Redis 7                                   |
| Payments    | Razorpay (UPI/cards)                      |

## Monorepo layout

```
zerosky-repo/
├── apps/
│   ├── pos-web         # Main POS terminal (Next.js 16)
│   ├── kds-display     # Kitchen Display System
│   └── mobile-app      # React Native/Expo waiter app (placeholder)
└── packages/
    ├── api             # tRPC routers, context, RBAC middleware
    ├── auth            # bcrypt password verification, JWT/session (session not wired to API yet)
    ├── database        # Prisma schema, migrations, seed
    ├── offline         # SQLite mirror + sync queue (WIP)
    ├── payments        # Razorpay client, reconciliation
    └── print           # ESC/POS thermal receipt rendering (Rust)
```

## Getting started

### Prerequisites

- **Node.js** >= 22
- **npm** >= 10
- **Docker** (for Postgres + Redis)

### Installation

```bash
# Clone the repo
git clone <repo-url>
cd zerosky-repo

# Install dependencies
npm install

# Start Postgres + Redis
cd packages/database
docker compose up -d

# Apply database schema
npx prisma migrate deploy

# Seed dev data
npx tsx prisma/seed.ts

cd ../..
```

### Development

```bash
# Run all apps in dev mode (port 3000 for pos-web, API on /api/trpc)
npm run dev
```

**Important:** Next.js 16 defaults to Turbopack, but `next.config.ts` has a webpack `extensionAlias` config. Dev and build commands **must** pass `--webpack`:

```bash
cd apps/pos-web
npm run dev    # already passes --webpack in package.json
npm run build  # already passes --webpack
```

### Login credentials (dev seed)

- **Tenant slug:** `zerosky-demo`
- **Users:**
  - Owner: `owner@zerosky.dev` / `zerosky123` (PIN: `1111`)
  - Manager: `manager@zerosky.dev` / `zerosky123` (PIN: `2222`)
  - Cashier: `cashier@zerosky.dev` / `zerosky123` (PIN: `3333`)
  - Waiter: `waiter@zerosky.dev` / `zerosky123` (PIN: `4444`)
  - Kitchen: `kitchen@zerosky.dev` / `zerosky123` (PIN: `5555`)

Password override: set `SEED_PASSWORD` before running `seed.ts`.

## Commands

| Command           | Description                              |
|-------------------|------------------------------------------|
| `npm run dev`     | Start all apps in dev mode (Turbo)      |
| `npm run build`   | Build all apps and packages              |
| `npm run test`    | Run tests across the workspace           |
| `npm run lint`    | Lint all packages                        |
| `npm run typecheck` | Type-check all packages                |
| `npm run clean`   | Clean build artifacts and node_modules   |

### Database commands (in `packages/database/`)

| Command                  | Description                              |
|--------------------------|------------------------------------------|
| `docker compose up -d`   | Start Postgres + Redis                   |
| `npx prisma migrate dev` | Create and apply a new migration         |
| `npx prisma migrate deploy` | Apply migrations (prod)               |
| `npx prisma studio`      | Open Prisma Studio (DB browser)          |
| `npx tsx prisma/seed.ts` | Seed dev tenant + menu + staff           |

## Documentation

- [Architecture](./docs/ARCHITECTURE.md) — Stack, data flow, multi-tenancy model
- [Deployment](./docs/DEPLOYMENT.md) — Docker, Vercel, environment variables
- [Development](./docs/DEVELOPMENT.md) — Commands, gotchas, testing
- [Security](./docs/SECURITY.md) — Current posture, known gaps
- [Roadmap](./docs/ROADMAP.md) — What's built vs not

## License

[MIT](./LICENSE) © 2026
