# 🚀 Zerosky POS - Autonomous MVP Build Plan

**Created:** 2026-07-23  
**Status:** ✅ Ready to Execute  
**Timeline:** 7 Days to MVP  
**Execution Mode:** Multi-Agent Autonomous

---

## 📋 Executive Summary

**Vision:** Build a production-ready restaurant POS (Petpooja clone) with 100% autonomous execution, clean pipeline, and full test coverage.

**Current Status:** 45% Complete (Backend fully merged, frontend scaffold ready)

**What's Done:**
- ✅ All 5 backend packages merged to `main` (5,067 LOC, 333 tests)
- ✅ Infrastructure ready (Turborepo, TypeScript, Docker, CI/CD)
- ✅ Next.js app scaffold created (running on localhost:3001)

**What's Left:** 6 days of frontend development to MVP

**Out of Scope (Per Your Request):**
- ❌ Zomato/Swiggy UPI integration (too complex)
- ❌ Partnership features (deferred)

---

## 🎯 MVP Definition - What We're Building

### Complete User Flow

```
1. Cashier Login (PIN)
   ↓
2. Select Table
   ↓
3. Browse Menu → Add Items to Cart → Apply Modifiers
   ↓
4. Send to Kitchen → Print KOT (Kitchen Order Ticket)
   ↓
5. Kitchen Marks Items Ready
   ↓
6. Generate Bill with GST Breakdown
   ↓
7. Accept Payment (Cash/Card/UPI - multi-tender)
   ↓
8. Print Receipt → Order Complete
```

### Features In Scope ✅

**Authentication:**
- ✅ Email + password login
- ✅ 4-6 digit PIN quick login (already implemented - 34 tests)
- ✅ 5 roles: OWNER, MANAGER, CASHIER, WAITER, KITCHEN
- ✅ JWT + Redis sessions

**Menu Management:**
- ✅ Categories (starters, mains, desserts, drinks)
- ✅ Items with price, description, modifiers
- ✅ Search & filter
- ✅ Availability toggle

**Order Management:**
- ✅ Table selection
- ✅ Cart with quantity adjustment
- ✅ Item notes ("no onions", "extra spicy")
- ✅ Order status tracking

**Kitchen Operations:**
- ✅ KOT generation (already implemented - 114 print tests)
- ✅ Thermal printer support (58mm/80mm ESC/POS)
- ✅ Kitchen display view
- ✅ Priority/rush orders

**Billing & GST:**
- ✅ GST breakdown (CGST + SGST or IGST)
- ✅ Service charge
- ✅ Discounts (flat/percentage)
- ✅ Tax compliance (0%, 5%, 12%, 18% rates)

**Payments:**
- ✅ Multi-tender (split between Cash/Card/UPI) - 81 tests
- ✅ Razorpay integration (Card + UPI) - **NO Zomato/Swiggy integration**
- ✅ Change calculation
- ✅ Receipt printing

**Offline Mode:**
- ✅ SQLite local storage (already implemented - 58 tests)
- ✅ Auto-sync when online
- ✅ Conflict resolution (3 strategies)

---

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────────────────┐
│  Frontend Layer                                  │
│  • apps/pos-web (Next.js 16 + Tailwind)        │
│  • apps/kds-web (Kitchen Display - Phase 2)    │
└───────────────────┬─────────────────────────────┘
                    │
                    │ tRPC (Type-safe API)
                    │
┌───────────────────▼─────────────────────────────┐
│  API Layer                                       │
│  • @zerosky/api (6 routers, 46 tests) ✅        │
│  • @zerosky/auth (JWT + RBAC, 34 tests) ✅      │
└───────────────────┬─────────────────────────────┘
                    │
        ┌───────────┼───────────┐
        │           │           │
┌───────▼────┐ ┌───▼────┐ ┌───▼────┐
│ @zerosky/  │ │@zerosky│ │@zerosky│
│ offline ✅ │ │payments│ │ print  │
│ 58 tests   │ │81 tests│ │114tests│
└────────────┘ └────────┘ └────────┘
                    │
┌───────────────────▼─────────────────────────────┐
│  Data Layer                                      │
│  • PostgreSQL 16 (primary)                      │
│  • Redis 7 (sessions + cache)                   │
│  • SQLite (offline)                             │
└─────────────────────────────────────────────────┘
```

---

## 📅 7-Day Execution Plan

### ✅ Day 1: COMPLETE (2026-07-22)

**Completed:**
- ✅ Verified all 5 feature branches (5,067 LOC, 333 tests)
- ✅ Merged to `main`: auth → api → offline → payments → print
- ✅ Resolved all merge conflicts
- ✅ Regenerated Prisma client
- ✅ TypeScript compiles clean
- ✅ Created `apps/pos-web` scaffold
- ✅ Dev server running (localhost:3001)

**Git Commits:**
- `7bdbb23` - feat: merge API package with 46 tests
- `fe54d22` - feat: merge auth package (JWT, bcrypt, PIN, RBAC, 34 tests)
- `8299721` - feat: merge offline package (SQLite sync, 58 tests)
- `7eef84b` - feat: merge payments package (Razorpay, multi-tender, 81 tests)
- `cd1559c` - feat: merge print package (ESC/POS, thermal printer, 114 tests)

---

### 🔨 Day 2: POS App Foundation (TODAY - 2026-07-23)

**Goal:** Connect frontend to backend, set up routing and layout

**Agent Team:**
- **frontend-architect** (lead) - App structure & routing
- **integration-engineer** - tRPC client wiring
- **ui-engineer** - Layout components

**Tasks:**

#### 1. tRPC Client Setup (2h)
```bash
cd apps/pos-web

# Install dependencies
pnpm add @trpc/client@next @trpc/react-query@next @trpc/server@next
pnpm add @tanstack/react-query
pnpm add @zerosky/api @zerosky/auth @zerosky/database
pnpm add zod
```

Create `lib/trpc.ts`:
```typescript
import { createTRPCReact } from '@trpc/react-query';
import type { AppRouter } from '@zerosky/api';

export const trpc = createTRPCReact<AppRouter>();
```

Create `app/providers.tsx`:
```typescript
'use client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { httpBatchLink } from '@trpc/client';
import { trpc } from '@/lib/trpc';
import { useState } from 'react';

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());
  const [trpcClient] = useState(() =>
    trpc.createClient({
      links: [
        httpBatchLink({
          url: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/trpc',
        }),
      ],
    })
  );

  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </trpc.Provider>
  );
}
```

#### 2. Authentication Setup (2h)
- Create `middleware.ts` for route protection
- Create auth context for token management
- Setup localStorage/cookie for JWT storage
- Auto-refresh token logic

#### 3. App Layout (2h)
```bash
# Install shadcn/ui
pnpm dlx shadcn@latest init
pnpm dlx shadcn@latest add button input card form label table badge
```

Create:
- Main layout with sidebar navigation
- Header with user menu + logout
- Dashboard landing page

#### 4. Environment Config (1h)
```bash
# .env.local
NEXT_PUBLIC_API_URL=http://localhost:3001/api/trpc
DATABASE_URL=postgresql://zerosky:zerosky_test_2607@127.0.0.1:5433/zerosky?schema=public
REDIS_URL=redis://localhost:6379
```

**Acceptance Criteria:**
- ✅ tRPC client successfully calls backend
- ✅ App layout renders with navigation
- ✅ Protected routes redirect to login
- ✅ Build completes without errors
- ✅ All 333 tests still passing

**Verification:** Different agent reviews and tests the integration

---

### 🔑 Day 3: Authentication & Authorization (2026-07-24)

**Goal:** Working login system with PIN and role-based access

**Agent Team:**
- **auth-specialist** (lead) - Authentication flow
- **ui-engineer** - Login UI
- **security-reviewer** - Security audit

**Tasks:**

#### 1. Login Page (3h)
- Create `/login` route
- Email + password form with Zod validation
- Call `auth.login` tRPC mutation
- Store JWT tokens (httpOnly cookies preferred)
- Redirect to dashboard on success

#### 2. PIN Login (2h)
- Create PIN entry component (4-6 digit)
- Call `auth.loginWithPin` mutation
- Auto-focus and keyboard navigation
- Quick cashier login

#### 3. Role-Based Access (2h)
- Create `useAuth()` hook
- Create `<ProtectedRoute>` component
- Implement role checks (OWNER, MANAGER, CASHIER, WAITER, KITCHEN)
- Hide/show UI elements based on role

#### 4. Session Management (1h)
- Auto-refresh access token
- Handle token expiration
- Logout functionality
- Session timeout warning

**Acceptance Criteria:**
- ✅ Login with email + password works
- ✅ Login with PIN works
- ✅ Tokens stored securely
- ✅ Protected routes work
- ✅ Role-based UI works
- ✅ Session refresh works
- ✅ Security review passed

**Verification:** Security agent audits auth flow

---

### 🍽️ Day 4: Menu Display & Management (2026-07-25)

**Goal:** Browse and search menu items

**Agent Team:**
- **data-engineer** (lead) - Menu data fetching
- **ui-engineer** - Menu UI
- **ux-reviewer** - Usability review

**Tasks:**

#### 1. Menu Data Layer (2h)
- Call `menu.getCategories` query
- Call `menu.getItems` with filters
- Implement search functionality
- Cache with react-query

#### 2. Category Navigation (2h)
- Category tabs/pills
- Filter items by category
- Item count per category
- Active category highlight

#### 3. Item Display (3h)
Create item card with:
- Image thumbnail
- Name and description
- Price (₹ formatted)
- Availability badge
- GST rate indicator
- Responsive grid (2-3-4 columns)

#### 4. Search & Filter (1h)
- Search by name
- Filter: vegetarian, price range, availability
- Real-time results
- Clear filters

**Acceptance Criteria:**
- ✅ Menu items load from backend
- ✅ Categories display correctly
- ✅ Item cards show all info
- ✅ Search works in real-time
- ✅ Filters apply correctly
- ✅ Responsive on tablet/desktop

**Verification:** UX agent reviews usability

---

### 🛒 Day 5: Cart & Order Creation (2026-07-26)

**Goal:** Add items to cart and create orders

**Agent Team:**
- **state-engineer** (lead) - Cart state management
- **ui-engineer** - Cart UI
- **integration-engineer** - Order API

**Tasks:**

#### 1. Cart State Management (2h)
Create `useCart()` hook:
- Add item to cart
- Update quantity (+ / -)
- Remove item
- Clear cart
- Calculate subtotal, tax, total

#### 2. Cart UI (3h)
Create cart sidebar with:
- Item list (name, quantity, price)
- Modifier tags
- Remove button
- Quantity controls
- Cart summary
- Empty cart state

#### 3. Modifiers & Customization (2h)
- Modifier selection modal
- Single-select (size: S/M/L)
- Multi-select (add-ons)
- Item notes textarea
- Apply to cart item

#### 4. Order Creation (1h)
- Table selection
- Call `order.create` mutation
- Send to kitchen
- Success confirmation
- Clear cart

**Acceptance Criteria:**
- ✅ Add items to cart works
- ✅ Quantity updates work
- ✅ Modifiers selectable
- ✅ Item notes work
- ✅ Cart calculates correctly
- ✅ Order creates in database
- ✅ Cart clears after order

**Verification:** Different agent tests full cart flow

---

### 🧾 Day 6: KOT & Billing (2026-07-27)

**Goal:** Generate KOT and bills with GST

**Agent Team:**
- **print-engineer** (lead) - KOT & bill generation
- **gst-specialist** - GST calculation
- **ui-engineer** - Bill preview

**Tasks:**

#### 1. KOT Generation (2h)
- Call `kot.create` mutation
- KOT format:
  - Order number & table
  - Timestamp
  - Items with quantities & notes
  - Priority flag
- Print to thermal (58mm/80mm)
- Print preview

#### 2. GST Calculator (3h)
Create `calculateGST()` utility:
- Detect customer state (intra vs inter-state)
- Calculate CGST + SGST (intra-state)
- Calculate IGST (inter-state)
- Apply rates: 0%, 5%, 12%, 18%
- GST-inclusive vs exclusive pricing

#### 3. Bill Preview (2h)
Bill components:
- Restaurant info (name, address, GSTIN)
- Bill number & date
- Table number
- Itemized list
- Subtotal
- GST breakdown (CGST/SGST/IGST)
- Service charge
- Discount
- Grand total
- Print button
- PDF export

#### 4. Discount Application (1h)
- Flat discount (₹)
- Percentage discount
- Manager approval for > 10%
- Update bill total

**Acceptance Criteria:**
- ✅ KOT prints correctly
- ✅ GST calculates accurately
- ✅ Bill shows complete breakdown
- ✅ Discount applies correctly
- ✅ Receipt format is print-ready
- ✅ GST compliance verified

**Verification:** GST specialist verifies calculations

---

### 💳 Day 7: Payments & MVP Complete (2026-07-28)

**Goal:** Accept payments and complete orders (MVP READY!)

**Agent Team:**
- **payment-engineer** (lead) - Payment flow
- **razorpay-specialist** - Razorpay integration
- **qa-engineer** - End-to-end testing

**Tasks:**

#### 1. Payment Screen (2h)
- Show final bill amount
- Payment method selector (CASH, CARD, UPI)
- Razorpay for CARD + UPI
- Cash input with change calculation

#### 2. Multi-Tender Support (2h)
- Split payment between methods
- Example: ₹500 Cash + ₹500 UPI
- Track breakdown
- Validate total = bill amount

#### 3. Payment Confirmation (1h)
- Call `payment.create` mutation
- Verify with Razorpay webhook
- Mark order as PAID
- Print receipt
- Success message

#### 4. Order Completion (1h)
- Update status to COMPLETED
- Clear table
- Archive order
- Return to dashboard

#### 5. End-to-End Testing (2h)
Test complete flow:
- Login → Menu → Cart → KOT → Bill → Payment → Complete
- Test all payment methods
- Test edge cases (empty cart, out of stock, payment failure)
- Multi-user scenarios
- GST calculation verification

**Acceptance Criteria:**
- ✅ All payment methods work
- ✅ Multi-tender splits correctly
- ✅ Razorpay integration works (NO Zomato/Swiggy)
- ✅ Change calculation correct
- ✅ Receipt prints
- ✅ Order completes and archives
- ✅ Full flow works end-to-end
- ✅ **🎉 MVP COMPLETE!**

**Verification:** QA agent runs full E2E test suite

---

## 🤖 Multi-Agent Orchestration

### Agent Roles

**Orchestrator (You)**
- Coordinates all agents
- Validates deliverables
- Manages timeline
- Quality gates

**Frontend Architect**
- UI/UX design
- Component architecture
- Routing

**Integration Engineer**
- Backend-frontend integration
- tRPC setup
- API contracts

**Auth Specialist**
- Authentication flows
- Security
- RBAC

**Payment Engineer**
- Payment flows
- Razorpay integration
- Multi-tender

**Print Engineer**
- ESC/POS printing
- KOT generation
- Receipt formatting

**GST Specialist**
- GST calculations
- Tax compliance
- Bill formatting

**QA Engineer**
- Testing
- Verification
- Quality assurance

### Communication Protocol

**Daily Sync:**
1. Review previous day's deliverables
2. Assign tasks for current day
3. Identify blockers

**Continuous Integration:**
- Feature branches for each task
- PRs with descriptions
- Automated tests must pass
- Peer review before merge

**Quality Gates (Every Deliverable):**
- ✅ Code compiles without errors
- ✅ All tests pass (existing + new)
- ✅ TypeScript strict mode passes
- ✅ Functional requirements met
- ✅ Reviewer approval (different agent)

**Fact-Checking Protocol:**
- No assumptions or placeholders
- Every claim verified against code/database
- Documentation matches implementation
- Test coverage for all features

---

## ✅ Quality Standards

### Code Quality
- **TypeScript Strict Mode:** All code must pass `strict: true`
- **No `any` types:** Use proper type definitions
- **No TODO/FIXME:** Complete implementation only
- **No dead code:** Remove unused imports/variables
- **Consistent formatting:** Prettier with project config

### Test Coverage
- **Minimum 80% coverage** per package
- **Unit tests:** All business logic
- **Integration tests:** API endpoints
- **E2E tests:** Critical user flows
- **No skipped tests:** Fix or remove

### Security
- **JWT tokens:** httpOnly cookies preferred
- **Password hashing:** bcrypt with 12 rounds (✅ done)
- **SQL injection:** Prisma parameterized (✅ safe)
- **XSS protection:** React auto-escaping + CSP
- **CORS:** Proper origin whitelist
- **Rate limiting:** In API layer (✅ done)

### Performance
- **First Load:** < 3 seconds
- **API Response:** < 500ms (p95)
- **Bundle Size:** < 300kb (main)
- **Database:** N+1 prevention

### Accessibility
- **Keyboard Navigation:** All elements accessible
- **ARIA Labels:** Screen reader support
- **Color Contrast:** WCAG AA (4.5:1)
- **Focus Indicators:** Visible focus states

---

## 🧪 Testing Strategy

### Test Pyramid

**E2E Tests (10%):**
- Complete order flow: login → cart → payment
- Kitchen flow: KOT → prepare → serve

**Integration Tests (30%):**
- tRPC endpoint tests
- Database operations
- Authentication middleware

**Unit Tests (60%):**
- GST calculator
- Payment splitter
- Cart calculations

### Test Automation

**Pre-commit:**
- Run affected tests
- Lint and format check
- TypeScript compilation

**Pre-merge (GitHub Actions):**
- Run all tests (333 + new)
- Build all packages
- TypeScript typecheck
- Coverage report
- Threshold enforcement (80%+)

---

## 📦 Deployment Pipeline

### Environments

**Local Development:**
- `pnpm dev` - Next.js dev server
- PostgreSQL via Docker Compose
- Redis via Docker Compose

**Staging (future):**
- AWS/Vercel deployment
- Staging database
- Redis Cloud

**Production (future):**
- Multi-region deployment
- PostgreSQL replication
- Redis cluster
- CDN

---

## 🚨 Risk Mitigation

### Technical Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| Database connection issues | High | SSH tunnel health check, auto-reconnect, SQLite fallback |
| Test flakiness | Medium | Run 2-3x in CI, fix non-deterministic tests, proper seeding |
| Razorpay complexity | Medium | Skip Zomato/Swiggy, use test mode, error handling |
| Print compatibility | Medium | Support 58mm/80mm, PDF fallback, ESC/POS standard |
| Type errors | Low | Already resolved, strict TypeScript prevents future issues |

### Process Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| Agent coordination | High | Clear ownership, daily sync, handoff protocol |
| Scope creep | Medium | Strict MVP definition, defer non-essential |
| Fact-checking failures | High | Dual-agent verification, no self-approval |
| Timeline slippage | Medium | Buffer time, parallel work, daily tracking |

---

## 📊 Success Metrics

### Delivery Metrics
- ✅ All 7 days completed on time
- ✅ 333+ tests passing
- ✅ 0 TypeScript errors
- ✅ 80%+ test coverage
- ✅ 0 critical bugs in MVP

### Quality Metrics
- ✅ All quality gates passed
- ✅ All deliverables fact-checked
- ✅ Documentation matches implementation
- ✅ Clean git history
- ✅ No placeholder/TODO code

### Functional Metrics
- ✅ Complete order flow works
- ✅ All payment methods work (no Zomato/Swiggy)
- ✅ GST calculations verified
- ✅ KOT and receipt printing works
- ✅ Multi-user roles working

---

## 🎉 MVP Launch Checklist

### Pre-Launch
- [ ] All 7 days complete
- [ ] All tests passing (333+)
- [ ] No TypeScript errors
- [ ] No console errors
- [ ] All quality gates passed
- [ ] Security review complete
- [ ] Performance benchmarks met
- [ ] Accessibility audit passed

### Launch Day
- [ ] Deploy to staging
- [ ] Run E2E tests
- [ ] Load test (10 concurrent users)
- [ ] Verify database backup
- [ ] Verify Redis persistence
- [ ] Monitor error logs
- [ ] Tag release v1.0.0
- [ ] Deploy to production
- [ ] Health check green
- [ ] First production order

### Post-Launch
- [ ] Monitor for 24 hours
- [ ] Gather user feedback
- [ ] Fix critical bugs
- [ ] Plan Phase 2

---

## 📚 Documentation Deliverables

### Technical Docs
- [ ] API Documentation - All tRPC endpoints
- [ ] Database Schema - ERD and tables
- [ ] Environment Setup - README
- [ ] Deployment Guide
- [ ] Architecture Decision Records

### User Docs
- [ ] User Manual
- [ ] Training Videos
- [ ] Troubleshooting Guide
- [ ] FAQ

---

## 🎯 What's Next?

### Immediate: Execute Day 2

**Agent Command:**
```bash
# Use multi-agent orchestration skill
/agent-team-orchestration

# Spawn agents:
# - frontend-architect (lead)
# - integration-engineer  
# - ui-engineer

# Tasks: Day 2 deliverables (tRPC setup, auth setup, layout, config)
```

### Tomorrow: Day 3 (Authentication)

Continue with auth-specialist, ui-engineer, security-reviewer

### This Week: MVP Complete by Day 7 (2026-07-28)

---

## 🔗 Technology Stack

**Frontend:**
- Next.js 16.2.10 (App Router)
- React 19
- Tailwind CSS
- shadcn/ui
- TypeScript

**Backend:**
- tRPC (type-safe API)
- Prisma 5 (ORM)
- PostgreSQL 16
- Redis 7
- Node.js 22

**Auth:**
- JWT (jsonwebtoken)
- bcrypt
- Redis sessions

**Payments:**
- Razorpay SDK
- **NO Zomato/Swiggy integration**

**Printing:**
- ESC/POS protocol
- Thermal printer support

**Testing:**
- Jest
- React Testing Library
- Playwright (E2E)

**CI/CD:**
- GitHub Actions
- pnpm
- Turborepo

---

## 📝 Notes

**Inspiration:** Petpooja (study only)

**Code Ownership:** All code is original and owned

**What We're Skipping:**
- Zomato/Swiggy UPI integration (too complex)
- Partnership features (post-MVP)
- Inventory management (post-MVP)
- Reporting & analytics (post-MVP)

**Quality Mandate:**
- Clean pipeline
- Fact-checked deliverables
- No slapdash work
- Evidence-based claims only

---

**Status:** ✅ Ready to Execute  
**Current:** Day 2 - POS App Foundation  
**Target:** Day 7 - MVP Complete (2026-07-28)

**Let's build this autonomously! 🚀**
