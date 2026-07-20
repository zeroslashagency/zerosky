<div align="center">

# zerosky

**Open-source restaurant POS — billing, KOT/KDS, offline-first, India-ready.**

[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](./LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue.svg)](https://www.typescriptlang.org/)
[![Turborepo](https://img.shields.io/badge/Turborepo-2.x-EF4444.svg)](https://turbo.build/)

</div>

---

## What is zerosky?

zerosky is an open-source point-of-sale platform for restaurants. It covers the
full service loop — menu, order, KOT, kitchen display, billing, printing, and
payments — with an offline-first core so the floor keeps running when the
internet does not.

Built for the India market: GST billing, UPI payments, and Zomato/Swiggy
aggregator sync are first-class, not add-ons.

## Highlights

- **Offline-first** — SQLite mirror + sync queue; 100% uptime on the floor
- **KOT / KDS** — full ticket lifecycle, multi-station kitchen display, real-time
- **GST billing** — tax profiles, discounts, 58/80mm thermal receipts
- **India payments** — Razorpay UPI, multi-tender, reconciliation
- **Aggregators** — Zomato & Swiggy orders into one unified kitchen queue
- **Self-host or cloud** — own your data, any payment provider, no lock-in

## Tech stack

| Layer | Choice |
|---|---|
| Language | TypeScript everywhere |
| Monorepo | Turborepo + pnpm |
| Web | Next.js 14 + React + Tailwind |
| API | tRPC + Fastify (REST for mobile) |
| Data | Prisma · PostgreSQL · Redis · SQLite (offline) |
| Payments | Razorpay (UPI/cards) |

## Monorepo layout

```
zerosky/
├── apps/            # pos-web, kds-display, owner-dash, customer-web, waiter-mobile
└── packages/        # database, api, auth, offline, print, payments, aggregators, notifications
```

> Apps and packages land incrementally, batch by batch. `packages/database`
> (Prisma schema + Postgres/Redis) is the first workspace package.

## Getting started

```bash
pnpm install
pnpm build       # turbo build across the workspace
pnpm dev         # run apps in dev
pnpm lint        # lint
pnpm typecheck   # type check
```

Requires **Node >= 22** and **pnpm >= 11**.

### Database

```bash
cd packages/database
cp .env.example .env
pnpm db:up          # start Postgres + Redis (Docker)
pnpm db:push        # apply the Prisma schema
pnpm db:seed        # load demo tenant, menu, tables, staff
pnpm db:studio      # browse data
```

## License

[MIT](./LICENSE) © 2026 zeroslashagency
