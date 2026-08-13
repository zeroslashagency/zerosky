# Zerosky Feature Gap Analysis

**Generated:** 2026-07-27  
**Repository:** `/Users/xoxo/Documents/resreah/billing/zerosky-repo`  
**Benchmarks:** PetPooja (90/100), URY-ERP (92/100), ahmedali5530 (88/100)

---

## Executive Summary

**Zerosky Status:** Phase 1 MVP Complete (Core POS functional)  
**Current Maturity:** ~65/100 vs PetPooja, ~60/100 vs URY  
**Critical Gaps:** Aggregators (Zomato/Swiggy), Offline-first UI, Recipe BOM auto-deduction, Production security hardening

### What's Built vs What's Missing

| Category | Built | Missing | Priority |
|----------|-------|---------|----------|
| **Core POS** | 90% | QR ordering, seat-split billing | P1 |
| **Kitchen Ops** | 85% | Multi-station routing (schema ready), fire/hold courses | P1 |
| **India Features** | 30% | **Zomato/Swiggy integration**, UPI live flow, WhatsApp | **P0** |
| **Offline** | 40% | Sync engine built (Rust), UI wiring missing | P1 |
| **Inventory** | 60% | BOM auto-deduction, waste alerts, recipe costing | P2 |
| **Security** | 50% | JWT not wired, PINs in plaintext, no RLS | **P0** |
| **UI/UX** | 70% | Modern but rough edges, no mobile app | P2 |

---

## 1. Implemented Features (What Zerosky Has)

### ✅ Core POS (Week 1-12 from roadmap)

| Feature | Status | Notes |
|---------|--------|-------|
| Multi-tenant + branch model | ✅ Complete | Tenant → Branch → Tables/Orders |
| RBAC (5 roles) | ✅ Complete | OWNER/MANAGER/CASHIER/WAITER/KITCHEN |
| Login (email + PIN) | ✅ Complete | bcrypt passwords, plaintext PINs (security gap) |
| Menu management | ✅ Complete | Categories, Items, ModifierGroups, Modifiers |
| Modifier groups | ✅ Complete | min/max select, required, pricing |
| Order lifecycle | ✅ Complete | OPEN → SENT_TO_KITCHEN → READY → SERVED → BILLED → PAID → CANCELLED |
| Table management | ✅ Complete | State machine (AVAILABLE/OCCUPIED/RESERVED/BILLED/CLEANING) |
| Floor plan | ✅ Basic | List view with state, no drag-drop visual editor |
| KOT generation | ✅ Complete | Kitchen Order Tickets with station routing |
| KDS (Kitchen Display) | ✅ Complete | Separate app (`kds-display`), real-time polling (5s) |
| Multi-stage KDS | ⚠️ Partial | Schema supports stations, but single default station in code |
| Billing + GST | ✅ Complete | Item-level tax rates, order tax total, discount tracking |
| Multi-tender payments | ✅ Complete | Cash/Card/UPI/Wallet/Aggregator/Complimentary |
| Shift open/close | ✅ Complete | Opening float, cash reconciliation, variance |
| Discounts | ✅ Complete | Percent/Flat, manager PIN required, audit trail |
| Basic inventory | ✅ Complete | Items, Suppliers, POs, Stock adjustments |
| Reports | ✅ Basic | Sales summary, shift reconciliation |
| Partnership/Franchise | ✅ CRUD only | Data model exists, no rev-share calc |

### ✅ Technical Infrastructure

| Component | Status | Notes |
|-----------|--------|-------|
| Monorepo (Turborepo) | ✅ Complete | npm workspaces, 7 packages + 4 apps |
| TypeScript full-stack | ✅ Complete | End-to-end type safety |
| tRPC v11 + superjson | ✅ Complete | Type-safe API, Date/Decimal serialization |
| Prisma ORM | ✅ Complete | 21 models, 10 enums, PostgreSQL 16 |
| Next.js 16 App Router | ✅ Complete | React 19, Tailwind CSS 4 |
| Docker Compose | ✅ Complete | Postgres + Redis containers |
| ESC/POS print engine | ✅ Complete | Rust package, 58/80mm templates, 114 tests |
| Razorpay SDK | ✅ Complete | Client wrapper, signature verify, 81 tests |
| Offline sync engine | ✅ Backend only | Rust SQLite mirror + LWW conflict resolution, 58 tests |
| Auth package | ✅ Backend only | JWT/bcrypt/RBAC, not wired to API context |
| Rate limiting | ✅ Complete | In-memory fixed-window, 1000 req/min |
| Test coverage | ✅ Good | Vitest: api, auth, payments, offline, print packages |
| CI/CD | ✅ Basic | GitHub Actions (lint + typecheck + test) |

---

## 2. Feature Gap vs PetPooja (India Market Leader, 90/100)

### ❌ CRITICAL GAPS (Show-stoppers for India market)

| Feature | PetPooja | Zerosky | Gap Severity | Notes |
|---------|----------|---------|--------------|-------|
| **Zomato integration** | ✅ Native API | ❌ None | **CRITICAL** | Orders don't flow to POS from aggregator |
| **Swiggy integration** | ✅ Native API | ❌ None | **CRITICAL** | Partner records exist but no live sync |
| **UPI live flow** | ✅ QR + collect | ⚠️ Manual only | **HIGH** | Razorpay SDK exists but no webhook handler |
| **WhatsApp bills/reports** | ✅ Yes | ❌ None | **HIGH** | Common in India SMB market |
| **GST speed** | ✅ Optimized | ⚠️ Functional | MEDIUM | Works but UX slower than PetPooja |
| **Aggregator unified queue** | ✅ Yes | ❌ None | **CRITICAL** | All orders (Zomato/Swiggy/dine-in) in one KDS |
| **Online ordering portal** | ✅ White-label | ❌ None | HIGH | Customer web app deferred |

### ⚠️ MEDIUM GAPS (Functional but rough)

| Feature | PetPooja | Zerosky | Notes |
|---------|----------|---------|-------|
| Offline mode | ⚠️ Partial | ⚠️ Backend ready, UI not wired | Sync engine exists but not exposed |
| Multi-branch reporting | ✅ Yes | ⚠️ Basic | Single-branch works, consolidated reports missing |
| Loyalty program | ✅ Yes | ❌ None | Deferred to later phase |
| Customer CRM | ✅ Yes | ❌ None | No customer records yet |
| Delivery dispatch | ✅ Yes | ❌ None | No rider tracking |
| Reservations | ⚠️ Basic | ❌ None | Not in schema |

### ✅ WHERE ZEROSKY WINS

| Feature | PetPooja | Zerosky | Advantage |
|---------|----------|---------|-----------|
| **Offline-first** | ⚠️ Partial | ✅ Full (when wired) | SQLite mirror + LWW sync built in Rust |
| **Self-host** | ❌ SaaS only | ✅ Full source | MIT license, own your data |
| **Payment freedom** | ❌ Locked | ✅ Any PSP | Razorpay wrapper, not locked in |
| **Open source** | ❌ Proprietary | ✅ MIT | Full customization |
| **Modern stack** | ❌ Legacy | ✅ Next.js 16 + React 19 | Type-safe, modern DX |

---

## 3. Feature Gap vs URY-ERP (Best OSS, 92/100)

### ❌ CRITICAL GAPS vs URY

| Feature | URY-ERP | Zerosky | Gap |
|---------|---------|---------|-----|
| **KOT state machine depth** | ✅ Best-in-class (NEW/MODIFIED/PARTIAL/FULL_CANCEL) | ✅ Good | URY has attention timers, captain transfer |
| **Multi-kitchen routing** | ✅ Color-coded, delay alerts, audio | ⚠️ Schema ready, single default | Need to wire station per item |
| **Recipe BOM auto-deduction** | ✅ Live stock deduction on KOT | ❌ None | Inventory + recipes exist, no link to orders |
| **Daily P&L with COGS** | ✅ Yes | ❌ None | Sales reports exist but no cost tracking |
| **Table attention timer** | ✅ Yes (minutes since order) | ❌ None | Basic state only, no timer UI |
| **Captain performance** | ✅ Yes | ❌ None | No waiter metrics |
| **Multi-outlet live proof** | ✅ 10+ outlets claimed | ⚠️ Schema ready | Not tested at scale |
| **ERPNext backend** | ✅ Full accounting | ❌ None | Zerosky is standalone POS, not full ERP |

### ✅ WHERE ZEROSKY WINS vs URY

| Feature | URY-ERP | Zerosky | Advantage |
|---------|---------|---------|-----------|
| **Modern UI** | ⚠️ Frappe (dated) | ✅ Next.js 16 + Tailwind 4 | Faster dev, better UX |
| **Stack simplicity** | ❌ Heavy (Frappe + ERPNext) | ✅ Standalone monorepo | No Python/Frappe dependency |
| **Deployment** | ⚠️ Complex | ✅ Docker Compose + Vercel | Easier to self-host |
| **License** | ⚠️ AGPL-3.0 (copyleft) | ✅ MIT (permissive) | No SaaS source-share obligation |
| **Test coverage** | ⚠️ Unknown | ✅ 367 tests across 5 packages | Vitest + Playwright E2E |

---

## 4. Feature Gap vs ahmedali5530 (88/100, widest modern features)

### ❌ MISSING vs ahmedali5530

| Feature | ahmedali5530 | Zerosky | Notes |
|---------|--------------|---------|-------|
| **Seat-split billing** | ✅ Yes (by seat, by item, by amount) | ❌ None | Multi-tender exists but no seat-level split |
| **Multi-order per table** | ✅ Yes | ❌ None | One active order per table |
| **Nested modifiers** | ✅ Yes (modifier groups + sub-groups) | ⚠️ One level only | ModifierGroup → Modifier, no nesting |
| **Delivery app** | ✅ Separate app + maps | ❌ None | Mobile app is placeholder |
| **Tips pooling** | ✅ Yes | ❌ None | Payment records exist but no tip split |
| **Multi-lingual** | ✅ 10 langs + RTL | ❌ English only | i18n not wired |
| **AI reports** | ⚠️ Claimed (verify) | ❌ None | Basic SQL reports only |

### ✅ WHERE ZEROSKY WINS vs ahmedali5530

| Feature | ahmedali5530 | Zerosky | Advantage |
|---------|--------------|---------|-----------|
| **Community proof** | ❌ 20 stars, 4 forks | ⚠️ 0 stars (new) | ahmedali low proof, zerosky untested |
| **License clarity** | ❌ No license declared | ✅ MIT | Legal to deploy |
| **Production signal** | ⚠️ Active dev, no scale proof | ⚠️ New | Equal (both unproven) |
| **Architecture docs** | ❌ None | ✅ Full (ARCHITECTURE.md, SECURITY.md) | Better for adopters |

---

## 5. UI/UX Gap Analysis

### ✅ What's Good

- **Modern Tailwind 4 design** with custom palette (`kds-fresh/warn/late` colors)
- **Responsive** (desktop + tablet tested)
- **Dark mode ready** (theme system in place)
- **Type-safe forms** (tRPC + React Query)
- **Real-time KDS** (polling, can upgrade to WebSocket push)
- **Accessibility** (Playwright axe-core WCAG 2 AA smoke check passes)

### ❌ What's Missing (vs PetPooja/URY)

| UX Feature | Status | Impact |
|------------|--------|--------|
| **Touch-optimized** | ⚠️ Partial | Button sizes OK but no gesture support |
| **Drag-drop floor plan** | ❌ None | Text list only, not visual |
| **Modifier modal** | ✅ Yes | Functional but basic |
| **Table attention timer** | ❌ None | No visual urgency indicator |
| **KDS audio alerts** | ❌ None | Silent, no bell on new order |
| **KDS color coding by age** | ✅ Yes | <5min green, 5-10 yellow, >10 red |
| **Bill preview before print** | ✅ Yes | Works |
| **Mobile waiter app** | ❌ Placeholder only | React Native shell exists, no features |
| **QR table ordering** | ❌ None | Customer-facing app deferred |
| **Print customization UI** | ❌ None | ESC/POS templates hardcoded |
| **Multi-language** | ❌ English only | No i18n wired |

### 🎨 UI Completeness by Screen

| Screen | Status | Missing |
|--------|--------|---------|
| Login | ✅ Complete | Theme switcher (exists but not prominent) |
| Dashboard | ✅ Basic | Real-time stats, chart library |
| Menu Builder | ✅ Complete | Image upload, bulk import |
| Order Create | ✅ Complete | Seat split, multi-order per table |
| Floor Plan | ⚠️ List only | Visual drag-drop editor |
| KDS | ✅ Good | Audio alerts, manual sort/filter |
| Billing | ✅ Complete | Split by seat |
| Shift Close | ✅ Complete | Variance reasons, petty cash |
| Reports | ⚠️ Basic | Charts, hourly heatmap, waiter metrics |
| Inventory | ✅ Basic | Low-stock alerts, expiry tracking |
| Settings | ⚠️ Partial | Printer config, aggregator credentials |
| Staff Management | ✅ Complete | Photo upload, attendance |

---

## 6. Implementation Quality Issues

### 🔴 Security Gaps (from SECURITY.md)

| Issue | Severity | Fix Effort | Notes |
|-------|----------|------------|-------|
| **PINs in plaintext** | CRITICAL | 2 hours | Hash with bcrypt, add `pinHash` column |
| **No JWT expiration** | CRITICAL | 1 day | Wire `@zerosky/auth` SessionManager |
| **No httpOnly cookies** | HIGH | 30 min | Set cookie flags |
| **No PostgreSQL RLS** | MEDIUM | 1 day | Add row-level security policies |
| **No audit trail** | LOW | 1 day | Add `performedBy` fields to sensitive actions |

### 🟡 Technical Debt

| Issue | Impact | Fix Effort |
|-------|--------|------------|
| **Offline sync not wired** | High | 2-3 weeks | Connect Rust engine to UI |
| **KDS polling (not push)** | Medium | 1 day | Replace with Redis pub/sub |
| **No printer discovery UI** | Medium | 1 week | mDNS + IP:9100 scan |
| **No webhook handlers** | High | 1 week | Razorpay + aggregator webhooks |
| **Single default kitchen station** | Medium | 2 days | Wire station per item |
| **No recipe BOM auto-deduction** | Medium | 1 week | Link recipes to order items |

### 🟢 What's Well-Built

- ✅ **Clean architecture**: Monorepo, clear package boundaries
- ✅ **Type safety**: End-to-end TypeScript, tRPC
- ✅ **Test coverage**: 367 tests (api, auth, payments, offline, print)
- ✅ **Prisma schema**: Well-normalized, FK constraints, indexes
- ✅ **Rate limiting**: In-memory, swappable for Redis
- ✅ **ESC/POS engine**: Pure Rust, zero external crates, 114 tests
- ✅ **Documentation**: ARCHITECTURE.md, SECURITY.md, ROADMAP.md, DEVELOPMENT.md

---

## 7. Killer Features Missing (Must-Have for Market Fit)

### P0 (Without these, can't compete with PetPooja)

1. **Zomato/Swiggy integration** ❌
   - Orders from aggregators → KDS
   - Menu sync (map external items to zerosky items)
   - Status sync (ACCEPTED → FOOD_READY → DISPATCHED)
   - **Effort:** 3-4 weeks (Zomato + Swiggy partner API, webhook handlers, dedup logic)

2. **UPI live flow** ⚠️ (Backend 60% done)
   - Dynamic UPI QR generation
   - Razorpay webhook handler (payment.captured → Order.PAID)
   - UPI collect request (push to customer's GPay/PhonePe)
   - **Effort:** 1 week

3. **Security hardening** 🔴
   - JWT with expiration + refresh rotation
   - Hash PINs with bcrypt
   - httpOnly cookies
   - **Effort:** 2-3 days

### P1 (Differentiators vs Weak OSS)

4. **Offline-first UI** ⚠️ (Backend 100% done, UI 0%)
   - Wire Rust SQLite sync to POS web UI
   - Offline indicator + manual sync trigger
   - Conflict resolution UI (show merge conflicts)
   - **Effort:** 2-3 weeks

5. **Recipe BOM auto-deduction** ⚠️ (Schema 100%, logic 0%)
   - Link RecipeIngredient to OrderItem on KOT generate
   - Decrement InventoryItem.currentStock
   - Low-stock alerts (red badge on inventory screen)
   - **Effort:** 1 week

6. **Multi-station KDS routing** ⚠️ (Schema ready, not wired)
   - Add `Item.station` field (nullable, default null)
   - Group KOT items by station
   - Kitchen staff filters KDS by their station
   - **Effort:** 2 days

7. **Floor plan visual editor** ❌
   - Drag-drop table placement
   - Section grouping (Main hall, Rooftop, Patio)
   - Occupancy heatmap
   - **Effort:** 1 week

8. **WhatsApp Business API** ❌
   - Bill share (PDF attachment)
   - Daily report to owner
   - Order confirmation to customer
   - **Effort:** 1 week (Twilio/MessageBird integration)

### P2 (Nice-to-Have)

9. **Seat-split billing** ❌
   - Split by seat (4 people, each pays their items)
   - Split by item (Item 1 → Person A, Item 2 → Person B)
   - Split by amount (₹500 + ₹300 + ₹200)
   - **Effort:** 1 week

10. **QR table ordering** ❌
    - Customer scans QR → mobile menu
    - Self-order (auto-assign to table)
    - Optional prepay (Razorpay link)
    - **Effort:** 2 weeks (customer web app)

11. **Mobile waiter app** ⚠️ (Shell exists, 0% functional)
    - Order taking offline
    - KOT print via Bluetooth
    - Table assign + transfer
    - **Effort:** 3-4 weeks (React Native/Expo)

12. **Daily P&L with COGS** ❌
    - Cost of goods sold (recipe BOM × quantity)
    - Gross profit (revenue - COGS - wastage)
    - Margin % per item
    - **Effort:** 1 week (after BOM wiring)

---

## 8. Feature Prioritization Matrix

### Impact vs Effort

```
High Impact, Low Effort (DO FIRST):
├─ Security hardening (2-3 days) 🔴
├─ Multi-station KDS (2 days) 🟡
├─ UPI webhook handler (2 days) 🟡
└─ Low-stock alerts UI (1 day) 🟢

High Impact, High Effort (STRATEGIC):
├─ Zomato/Swiggy integration (3-4 weeks) 🔴
├─ Offline-first UI wiring (2-3 weeks) 🟡
├─ Recipe BOM auto-deduction (1 week) 🟡
└─ Mobile waiter app (3-4 weeks) 🟡

Low Impact, Low Effort (POLISH):
├─ KDS audio alerts (1 day) 🟢
├─ Table attention timer (2 days) 🟢
├─ Print customization UI (3 days) 🟢
└─ WhatsApp bill share (1 week) 🟢

Low Impact, High Effort (DEFER):
├─ AI reports (4+ weeks) ⚪
├─ Multi-language i18n (2 weeks) ⚪
├─ Loyalty program (2 weeks) ⚪
└─ CRM (3 weeks) ⚪
```

---

## 9. What Needs Complete Rewrite?

### ✅ Nothing needs rewrite

**Current architecture is solid:**
- Clean TypeScript monorepo
- Type-safe tRPC API
- Well-normalized Prisma schema
- Good test coverage
- Docker-ready

**What needs wiring (not rewriting):**
- Offline sync UI (backend is done)
- JWT sessions (auth package is done)
- Multi-station routing (schema is ready)
- Recipe BOM deduction (schema is ready)

**What needs greenfield implementation:**
- Aggregator integrations (no OSS reference)
- Mobile waiter app (shell exists)
- Customer web app (deferred)
- WhatsApp Business API (deferred)

---

## 10. Comparison Summary Table

| Feature Category | PetPooja | URY-ERP | ahmedali5530 | **Zerosky** | Gap |
|------------------|----------|---------|--------------|-------------|-----|
| **Core POS** | 95/100 | 90/100 | 88/100 | **85/100** | -10 |
| **Kitchen Ops** | 95/100 | **95/100** | 85/100 | **80/100** | -15 |
| **India Payments** | 95/100 | 70/100 | 60/100 | **40/100** | **-55** 🔴 |
| **Aggregators** | **100/100** | 20/100 | 0/100 | **0/100** | **-100** 🔴 |
| **Multi-outlet** | 90/100 | **85/100** | 70/100 | **70/100** | -20 |
| **Inventory** | 85/100 | **90/100** | 80/100 | **60/100** | -30 |
| **Offline** | 80/100 | 70/100 | 60/100 | **40/100** | -40 |
| **Reports** | 90/100 | **95/100** | 70/100 | **50/100** | -45 |
| **Security** | 85/100 | 75/100 | ❓ | **50/100** | -35 🔴 |
| **Modern UI** | 80/100 | 60/100 | 75/100 | **70/100** | -10 |
| **Self-host** | 0/100 | **100/100** | 50/100 | **100/100** | **+100** ✅ |
| **Open Source** | 0/100 | **100/100** | 50/100 | **100/100** | **+100** ✅ |
| **Test Coverage** | ❓ | ❓ | ❓ | **90/100** | **+90** ✅ |
| **Documentation** | 70/100 | 60/100 | 40/100 | **85/100** | **+15** ✅ |
| **Overall** | **90/100** | **92/100** | **88/100** | **65/100** | **-25** |

---

## 11. Recommendations

### Immediate (Next 2 Weeks)

1. **Security hardening** (2-3 days)
   - Hash PINs
   - Wire JWT sessions
   - Set httpOnly cookies
   - **Blocker for production deployment**

2. **Multi-station KDS** (2 days)
   - Add `Item.station` field
   - Wire station filter in KDS display
   - Group KOT items by station

3. **UPI webhook handler** (2 days)
   - `/api/webhooks/razorpay` route
   - Verify signature
   - Update `Payment.status` → CAPTURED/FAILED

4. **Low-stock alerts** (1 day)
   - Red badge on inventory screen
   - Filter: `currentStock < minStockLevel`

### Short-term (Next 1-2 Months)

5. **Zomato integration** (2 weeks)
   - Partner API auth
   - Order webhook receiver
   - Menu sync (map items)
   - Status sync

6. **Swiggy integration** (2 weeks)
   - Same pattern as Zomato
   - Unified aggregator queue in KDS

7. **Recipe BOM auto-deduction** (1 week)
   - Link recipes to KOT generation
   - Decrement stock on order

8. **Offline-first UI** (2-3 weeks)
   - Wire Rust sync engine
   - Offline indicator
   - Conflict resolution UI

### Medium-term (Next 3-6 Months)

9. **Mobile waiter app** (3-4 weeks)
10. **Customer web app** (4 weeks)
11. **Floor plan visual editor** (1 week)
12. **Daily P&L with COGS** (1 week)
13. **WhatsApp Business API** (1 week)
14. **Multi-branch consolidated reports** (1 week)

---

## 12. Final Verdict

### Strengths

✅ **Solid MVP foundation**: Core POS loop works end-to-end  
✅ **Modern stack**: TypeScript, Next.js 16, tRPC, Prisma  
✅ **Good architecture**: Clean monorepo, type-safe, testable  
✅ **Self-hostable**: MIT license, Docker Compose ready  
✅ **Well-documented**: 4 docs files, clear roadmap  
✅ **Test coverage**: 367 tests, Vitest + Playwright  

### Critical Weaknesses

🔴 **No aggregators** (Zomato/Swiggy) — deal-breaker for India  
🔴 **Security not production-ready** — PINs in plaintext, no JWT expiration  
🔴 **Offline UI not wired** — backend done but invisible to users  
🔴 **No mobile app** — waiter app is placeholder  
🔴 **Basic reports** — no P&L, no waiter metrics, no charts  

### Market Positioning

**Can compete with:**
- FloCafe (offline desktop POS) — Zerosky has better multi-tenant + cloud
- Small OSS projects (simpos, amritmaurya) — Zerosky is more complete

**Cannot compete yet with:**
- PetPooja (90/100) — missing aggregators, UPI live, WhatsApp
- URY-ERP (92/100) — missing BOM auto-deduction, P&L, captain metrics
- Toast/Lightspeed (commercial) — missing scale, hardware, support

**Time to PetPooja parity:** 3-4 months (aggregators + security + offline UI + mobile)

**Time to URY parity:** 2-3 months (BOM + P&L + multi-station depth)

---

## 13. Action Plan (Roadmap Alignment)

### Phase 1: Security Hardening (Week 1-2) 🔴

- [ ] Hash PINs with bcrypt
- [ ] Wire JWT sessions with refresh rotation
- [ ] Set httpOnly cookies
- [ ] Add PostgreSQL RLS policies (optional, defense-in-depth)

### Phase 2: India Differentiators (Week 3-10) 🔴

- [ ] UPI webhook handler (Week 3)
- [ ] Zomato integration (Week 4-5)
- [ ] Swiggy integration (Week 6-7)
- [ ] WhatsApp Business API (Week 8)
- [ ] Multi-station KDS (Week 9)
- [ ] Recipe BOM auto-deduction (Week 10)

### Phase 3: Offline + Mobile (Week 11-18) 🟡

- [ ] Offline-first UI wiring (Week 11-13)
- [ ] Mobile waiter app MVP (Week 14-17)
- [ ] Bluetooth printer pairing (Week 18)

### Phase 4: Polish + Scale (Week 19-26) 🟢

- [ ] Floor plan visual editor
- [ ] Daily P&L with COGS
- [ ] Low-stock alerts + expiry tracking
- [ ] Multi-branch consolidated reports
- [ ] Customer web app (online ordering)
- [ ] QR table ordering

### Result

**After Phase 2 (10 weeks):**  
Zerosky → 85/100 (PetPooja parity on India features)

**After Phase 3 (18 weeks):**  
Zerosky → 90/100 (URY parity + mobile app)

**After Phase 4 (26 weeks):**  
Zerosky → 95/100 (Feature-complete restaurant OS)

---

**Generated by:** Kiro (Autonomous Code Agent)  
**Date:** 2026-07-27  
**Repository:** zerosky-repo (commit `db70d34`)
