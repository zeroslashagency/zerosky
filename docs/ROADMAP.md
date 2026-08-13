# Roadmap

What's built, what's deferred, and what's next.

## ✅ Built (MVP complete)

### Core POS
- [x] Multi-tenant architecture (Tenant → Branch → Table)
- [x] Role-based access control (OWNER, MANAGER, CASHIER, WAITER, KITCHEN)
- [x] Login (email + password, PIN)
- [x] Menu management (Category → Item → ModifierGroup → Modifier)
- [x] Order lifecycle (OPEN → SENT_TO_KITCHEN → READY → SERVED → BILLED → PAID → CANCELLED)
- [x] Cart with modifiers (min/max selection, pricing)
- [x] Table management (state: AVAILABLE, OCCUPIED, RESERVED, BILLED, CLEANING)
- [x] Billing (subtotal, tax, discount, grand total)
- [x] Multi-tender payments (cash, card, UPI, wallet, aggregator, complimentary)
- [x] GST calculation (per-item tax rate, order tax total)

### KOT/KDS
- [x] KOT generation (Kitchen Order Ticket)
- [x] KOT status tracking (NEW, MODIFIED, PARTIAL, READY, SERVED, CANCELLED)
- [x] Station routing (optional: "Tandoor", "Bar", "Cold kitchen")
- [x] Kitchen display view (`apps/kds-display`)

### Inventory
- [x] Inventory items (SKU, unit, current stock, min/max levels, reorder point)
- [x] Suppliers (contact info, CRUD)
- [x] Purchase orders (DRAFT, SENT, RECEIVED, CANCELLED)
- [x] Stock adjustments (IN, OUT, ADJUSTMENT, WASTAGE)

### Reports
- [x] Basic sales reports (order totals, payment breakdown)
- [x] Shift reconciliation (opening/closing cash, variance)

### Partnership
- [x] Partner/franchise records (CRUD)
- [x] Branch-partner association
- [x] Revenue share percentage (stored, not calculated yet)

### Security
- [x] bcrypt password hashing
- [x] Tenant-scoped queries
- [x] Rate limiting (general API + auth attempts)
- [x] RBAC middleware
- [x] No credential leakage (`staff.list` omits `passwordHash` and `pin`)

### Infrastructure
- [x] Turborepo monorepo (npm workspaces)
- [x] tRPC v11 API (superjson transformer)
- [x] Prisma ORM + PostgreSQL 16
- [x] Redis 7 (ready for sessions/cache)
- [x] Docker Compose (Postgres + Redis)
- [x] Next.js 16 (App Router)
- [x] React 19 + Tailwind CSS 4
- [x] Test coverage (Vitest): `api`, `auth`, `payments`, `offline`, `print`

## 🚧 Partially built (needs wiring)

### Offline-first
- [x] SQLite mirror schema (`packages/offline`)
- [x] Sync queue (conflict resolution, network detection)
- [ ] Wire to POS UI (pending: IndexedDB adapter, service worker)

### Auth
- [x] JWT generation/verification (`@zerosky/auth:jwt.ts`)
- [x] Redis session store with refresh rotation (`@zerosky/auth:session.ts`)
- [ ] Wire to API context (replace raw user ID tokens with JWT)

### Payments
- [x] Razorpay SDK client (`@zerosky/payments:razorpay.ts`)
- [x] Multi-tender state machine
- [ ] Webhook handler (Razorpay → mark payment CAPTURED/FAILED)
- [ ] UPI QR code generation
- [ ] Reconciliation dashboard

### Print
- [x] ESC/POS thermal receipt renderer (Rust, `packages/print`)
- [x] 58mm and 80mm templates
- [ ] Network printer discovery (mDNS, IP:9100)
- [ ] Print queue (retry, failure handling)

## ❌ Explicitly deferred

### Aggregator integration (Zomato/Swiggy)
**Status:** CRUD for partner records exists, but no live API sync.

**Why deferred:** User decision. Partnership features are placeholders for future expansion.

**To implement:**
- Zomato/Swiggy webhook receivers (order push)
- Signature verification (`@zerosky/aggregators:signature.ts` ready)
- Order parser (`@zerosky/aggregators:parsers.ts` ready)
- Mark aggregator orders as `OrderType.AGGREGATOR`

### Customer-facing features
- [ ] Customer web app (menu browsing, online ordering)
- [ ] QR code ordering (customer scans, orders from table)
- [ ] Loyalty program (points, rewards)

### Mobile app
- [ ] Waiter mobile app (`apps/mobile-app` exists as placeholder, not functional)
- [ ] Expo/React Native setup
- [ ] Offline order taking
- [ ] Bluetooth printer pairing

### Advanced inventory
- [ ] Recipe costing / Bill of Materials (BOM)
- [ ] Automatic stock deduction on order placement
- [ ] Low-stock alerts
- [ ] Supplier comparison (price history)
- [ ] Batch/expiry tracking

### Advanced reporting
- [ ] P&L (Profit & Loss) statement
- [ ] Hourly sales heatmap
- [ ] Item popularity ranking
- [ ] Waiter performance metrics
- [ ] Customer analytics (repeat rate, average spend)

### Multi-branch features
- [ ] Central kitchen inventory shared across branches
- [ ] Branch-to-branch transfers
- [ ] Consolidated reporting (all branches)

### Compliance
- [ ] GSTR-1/GSTR-3B export (GST filing)
- [ ] E-invoice generation (GST requirement for B2B > ₹5 crore turnover)
- [ ] TDS (Tax Deducted at Source) tracking

## 🎯 Next priorities (post-MVP)

### Phase 1: Security hardening (1-2 weeks)
1. Wire JWT sessions with refresh rotation
2. Hash PINs (migrate existing records)
3. Set `httpOnly` cookies
4. Add PostgreSQL RLS policies
5. Centralized logging (Datadog/CloudWatch)

### Phase 2: Production deployment (1 week)
1. Docker Compose for production (Postgres + Redis + API)
2. Dockerfile for `@zerosky/api` (multi-stage, non-root user)
3. Vercel config for `apps/pos-web`
4. CI/CD (GitHub Actions: test → build → deploy)
5. Secrets management (AWS Secrets Manager / env vars)

### Phase 3: Offline-first (2-3 weeks)
1. Wire SQLite mirror to POS UI
2. Service worker for background sync
3. Conflict resolution UI (show merge conflicts, let user choose)
4. "Offline mode" indicator in UI

### Phase 4: Payments polish (1 week)
1. Razorpay webhook handler
2. UPI QR code generation (static + dynamic)
3. Payment reconciliation dashboard (daily settlement summary)
4. Refund workflow (full/partial)

### Phase 5: Print system (1 week)
1. Network printer discovery
2. Print queue with retry
3. KOT customization (font size, logo, station routing)
4. Receipt customization (GST number, footer message)

## 📅 Long-term (6-12 months)

- Customer web app (online ordering, menu browsing)
- QR code ordering (dine-in self-service)
- Waiter mobile app (offline order taking)
- Recipe costing + BOM (auto stock deduction)
- Advanced reports (P&L, item popularity, waiter metrics)
- GSTR-1/GSTR-3B export (GST compliance)
- Multi-branch central inventory

## 🚫 Out of scope (for now)

- HR/payroll (attendance, salaries)
- CRM (customer database, marketing campaigns)
- Third-party delivery integration (Dunzo, Shadowfax)
- Booking/reservation system (OpenTable-style)
- Kitchen video streaming (live camera feed)

## Contribution welcome

See [CONTRIBUTING.md](../CONTRIBUTING.md) (TODO) for how to pick up a feature or fix a bug.

Priority issues will be tagged `good-first-issue` or `help-wanted` on GitHub.
