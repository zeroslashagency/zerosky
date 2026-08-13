# Architecture

Zerosky is a Turborepo monorepo running TypeScript end-to-end, with a Next.js frontend consuming a tRPC API backed by PostgreSQL.

## Stack

| Layer               | Technology                          |
|---------------------|-------------------------------------|
| **Frontend**        | Next.js 16 (App Router), React 19, Tailwind CSS 4 |
| **API**             | tRPC v11, superjson transformer     |
| **Data**            | Prisma ORM, PostgreSQL 16, Redis 7  |
| **Auth**            | bcrypt password verification, raw user ID tokens (JWT/session ready but not wired) |
| **Payments**        | Razorpay SDK (UPI, cards)           |
| **Print**           | ESC/POS thermal receipt renderer (Rust) |
| **Offline**         | SQLite mirror + sync queue (WIP)    |

## Data flow

```
[Browser/POS Terminal]
       ↓
  Next.js App Router (apps/pos-web)
       ↓
  tRPC client (@tanstack/react-query)
       ↓
  /api/trpc/[trpc]/route.ts (Next.js Route Handler)
       ↓
  @zerosky/api (tRPC routers)
       ↓ context.ts: resolveUser(token) → AuthUser
       ↓ trpc.ts: RBAC middleware (publicProcedure, protectedProcedure, roleProcedure)
       ↓
  Prisma queries (@zerosky/database)
       ↓
  PostgreSQL 16
```

**superjson:** tRPC transformer for Date, Decimal, BigInt serialization.

## Multi-tenancy model

```
Tenant (e.g., "Zerosky Demo Restaurant")
  └── Branch (e.g., "MG Road Outlet")
       ├── Tables
       ├── Orders
       └── Payments

User (Staff)
  └── belongs to Tenant, has Role (OWNER, MANAGER, CASHIER, WAITER, KITCHEN)
```

**Tenant isolation:** Every query in the API is scoped by `ctx.auth.tenant.id`. A user's token resolves to their `User` + `Tenant` via `context.ts:createDbUserResolver()`.

**Branch:** Each tenant can have multiple branches. Orders, tables, and payments are scoped to a branch.

## Order lifecycle

```
OPEN → SENT_TO_KITCHEN → READY → SERVED → BILLED → PAID
                                                    ↓
                                                CANCELLED (can happen at any stage)
```

1. **OPEN:** Order created, items being added (cart phase)
2. **SENT_TO_KITCHEN:** KOT printed, kitchen starts preparing
3. **READY:** Kitchen marks items ready
4. **SERVED:** Waiter confirms delivery to table
5. **BILLED:** Bill generated (tax, discounts applied)
6. **PAID:** Payment captured
7. **CANCELLED:** Order voided (with reason)

**KOT (Kitchen Order Ticket):** Links to OrderItems. Each KOT has:
- `kotNumber` (unique per order)
- `station` (optional: "Tandoor", "Bar", "Cold kitchen")
- `status` (NEW, MODIFIED, PARTIAL, READY, SERVED, CANCELLED)

## Authentication & sessions

**Current (MVP):**
- Tokens are raw user IDs (`User.id`)
- `context.ts:createDbUserResolver()` looks up the user directly from the database on every request
- No expiration, no refresh, no JWT signature

**Ready but not wired:**
- `@zerosky/auth` exports JWT generation/verification (`jwt.ts`) and Redis-backed session rotation (`session.ts`)
- To enable: replace `createDbUserResolver` with a JWT-verifying resolver in `createContext()`

## RBAC (Role-Based Access Control)

Enforced via `trpc.ts:roleProcedure(...roles)`:

```typescript
export const staffRouter = router({
  list: roleProcedure("OWNER", "MANAGER").query(async ({ ctx }) => {
    // Only OWNER and MANAGER can list staff
  }),
});
```

**Roles:**
- **OWNER:** Full access
- **MANAGER:** Staff, inventory, reports
- **CASHIER:** Orders, billing, payments
- **WAITER:** Orders, table management
- **KITCHEN:** KOT/KDS view only

## Rate limiting

Two tiers:

1. **General API:** 1,000 req/min per `clientId` (user ID if authenticated, else IP)
2. **Auth attempts:** 10 req/min per `clientId` (login, PIN login)

Limiter: in-memory fixed-window (`trpc.ts:createInMemoryRateLimiter`). Swappable for Redis via `setRateLimiter()`.

## Payments

**Current:**
- Multi-tender: cash, card, UPI, wallet, aggregator, complimentary
- Razorpay SDK integrated in `@zerosky/payments`
- Payment status: PENDING → CAPTURED | FAILED | REFUNDED

**Flow:**
1. Order status → BILLED
2. Payment record created (method, amount)
3. For UPI/card: call Razorpay, store `reference` (txn ID)
4. Webhook handler (TODO) updates status to CAPTURED/FAILED
5. Order status → PAID when all payments captured

## Inventory

**Data model:**
- `InventoryItem` (tenantId, name, sku, unit, currentStock, minStockLevel)
- `Supplier` (tenantId, name, contact)
- `PurchaseOrder` (tenantId, supplierId, orderNumber, status: DRAFT/SENT/RECEIVED/CANCELLED)
- `StockAdjustment` (tenantId, inventoryItemId, type: IN/OUT/ADJUSTMENT/WASTAGE)

**Not yet wired:** Recipe costing / BOM (Bill of Materials) linking menu items to inventory deductions.

## Package graph (dependency order)

```
database (Prisma schema)
   ↓
auth (password hashing, JWT, sessions)
   ↓
api (tRPC routers, context, RBAC)
   ↓
pos-web, kds-display (Next.js apps)

Separate:
- payments (Razorpay client)
- print (ESC/POS Rust)
- offline (SQLite + sync, WIP)
```

## Known design decisions

1. **No GraphQL:** tRPC gives end-to-end type safety without codegen
2. **Prisma over raw SQL:** ORM trade-off for dev speed; complex reports may need `prisma.$queryRaw`
3. **Redis:** Session store (ready) + future job queue (Bull/BullMQ)
4. **Monorepo:** Shared types, coordinated versioning, single deploy artifact
5. **Offline-first deferred:** SQLite mirror exists in `@zerosky/offline` but not wired to the UI yet
