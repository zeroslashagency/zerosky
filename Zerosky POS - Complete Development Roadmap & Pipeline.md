# Zerosky Restaurant POS — Master Development Plan & Pipeline

**Goal:** Offline-first restaurant POS for the Indian market — billing, KOT/KDS, GST compliance, UPI/Razorpay payments, thermal printing, aggregator integration.

**Stack:** TypeScript monorepo (Turborepo + npm workspaces, Node 22, npm 10), Next.js 14, tRPC, Prisma 5, PostgreSQL 16, Redis 7, SQLite (offline).

---

## ⚠️ AUDIT CORRECTION (2026-07-21) — READ THIS FIRST

A previous QA doc (`.agents/qa/QA-REPORT.md`) and an earlier version of this file claimed that `packages/auth`, `packages/offline`, `packages/payments`, `packages/print` were **"phantom — no source, not in git, delete them."**

**That claim is FALSE and following it would destroy real, tested code.**

It happened because the agent inspected only the currently checked-out branch (`feature/api-package`), where those package folders show only leftover `coverage/` + `node_modules/` (git-ignored junk). **Their real source lives on their own feature branches.** This was verified by 6 independent agents reading each branch via `git show` (no checkout), plus an adversarial cross-check against raw git contents.

**Verified truth:**

| Package | Branch | Source files | Tests | Verdict |
|---|---|---|---|---|
| `@zerosky/database` | `main` | Prisma schema (13 models, 8 enums) + client | — | ✅ REAL, **merged to main** |
| `@zerosky/auth` | `feature/auth-package` | 8 (jwt, hash, pin, rbac, session, context, types, index) | 28 | ✅ REAL, unmerged |
| `@zerosky/api` | `feature/api-package` | 18 (6 routers, 8 schemas, trpc, context) | 35 | ✅ REAL, unmerged |
| `@zerosky/offline` | `feat/offline-package` | 9 | 46 | ✅ REAL, unmerged |
| `@zerosky/payments` | `feature/payments` | 13 | 66 | ✅ REAL, unmerged |
| `@zerosky/print` | `feature/print-package` | 11 | 84 | ✅ REAL, unmerged |

**Total: 259 real test cases. Zero stub/TODO/not-implemented markers. No skipped tests.**

**DO NOT RUN** `rm -rf packages/{auth,offline,payments,print}`. It is safe to delete only the stray `coverage/` folders on the `feature/api-package` working tree — never the packages.

---

## The five questions, answered

1. **Are the agents hallucinating?** The *code* is not. The *status reporting* was — the "phantom / delete them" verdict was a single-branch view reported as global truth. Every package is real on its own branch.
2. **Are they doing everything fine?** Engineering quality is genuine (integer-paise money, HMAC `timingSafeEqual`, bcrypt hashing, real ESC/POS bytes, 3 conflict-resolution strategies). Process is not — see #3.
3. **The pipeline?** Broken at the **merge step**, not authoring. Every feature branch is 1–4 commits ahead of `main` and **none is merged**. `git branch --merged main` shows only `main` + empty `orchestrator/*` scaffolds. The product does not exist on its own mainline.
4. **Are they testing?** Yes, and well — 259 real tests with real assertions. **Caveat: no agent has *executed* them in these audits (read-only), and CI does not run them yet**, so "green" is written-but-unrun on `main`.
5. **Is the pipeline fine?** No. Two gaps: (a) merges never happen → `main` is empty of features; (b) the CI test gate is staged but not live (uncommitted on the api branch, absent from `main`).

---

## Current merge topology

```
main ──────────────────► skeleton + @zerosky/database (13-model Prisma schema)   ✅ ONLY thing merged
 ├── feature/auth-package    → @zerosky/auth      (1 commit ahead)   ⏳ unmerged
 ├── feature/api-package      → @zerosky/api       (1 commit ahead)   ⏳ unmerged  ← working tree HEAD
 ├── feat/offline-package     → @zerosky/offline   (1 commit ahead)   ⏳ unmerged
 ├── feature/payments         → @zerosky/payments  (1 commit ahead)   ⏳ unmerged
 ├── feature/print-package     → @zerosky/print     (4 commits ahead)  ⏳ unmerged
 └── orchestrator/*            → empty scaffolds    (0 ahead)          🗑 safe to delete
```

Nothing beyond `apps/.gitkeep` exists for any UI. No app can be built until an API layer is merged and a CI gate is live.

---

## CI gate status — STAGED, NOT LIVE

The working tree (on `feature/api-package`) **already** adds:
- a `test` task to `turbo.json` (`dependsOn: ["^build"]`, outputs `coverage/**`)
- `test: "turbo run test"` in root `package.json`
- a `Test → npm test` step in `.github/workflows/ci.yml`

**But these edits are uncommitted and not on `main`**, so no PR is gated by tests yet. This must land on `main` first (step 1 below) so every subsequent merge is enforced.

Remaining CI gaps: `npm run lint` is a no-op (no ESLint config); coverage thresholds are set to 80% while real coverage is 90–99% (a regression to 80% would pass silently — raise thresholds per package to their measured floor).

---

## Build-order pipeline with dual-agent gates

**Gate rule (every step):** one agent builds/merges/runs tests; a **different** agent verifies (green build, tests actually executed and passing, no regressions) before the step counts done. No self-approval in the same context. Re-run each suite **2–3× in different orders** to catch order-dependence and shared-DB coupling.

Legend: ⬜ todo · 🔨 builder done · ✅ verifier-confirmed

### Step 1 — Land the CI gate on `main` 🔴 DO FIRST
- ⬜ 🔨 Commit `turbo.json` test task + root `test` script + `ci.yml` test step; open PR to `main`
- ⬜ ✅ Verifier: confirm CI runs `npm test` AND fails red on an intentionally broken test
- ⬜ ✅ Verifier: raise per-package coverage thresholds to measured floor (auth ~?, offline 98.89%, payments 97.92%, print 90%, api ?)

### Step 2 — Merge `@zerosky/auth` → main 🔴 foundational
- ⬜ 🔨 Merge branch; `npm test --workspace=@zerosky/auth` (28 tests) runs green in CI
- ⬜ ✅ Verifier (different agent): JWT sign/verify (jsonwebtoken v9, separate access/refresh secrets), bcryptjs @12 rounds, 5-tier RBAC, Redis session rotation + reuse-revocation — swap `ioredis-mock` note, run 2–3× reordered

### Step 3 — Merge `@zerosky/api` → main
- ⬜ 🔨 Merge; 35 tests green. Integration tests need a **seeded Postgres service container** in CI — provision it or gate integration behind a service
- ⬜ 🔨 Wire `UserResolver` seam → real `@zerosky/auth` resolver (`createDbUserResolver`)
- ⬜ ✅ Verifier: 6 routers (auth/menu/order/kot/table/payment) tenant-scoped, middleware chain (error/logger/rate-limit/auth-guard/role-guard), Zod inputs; confirm the seam is now wired not stubbed

### Step 4 — Merge offline / payments / print → main (parallel-safe, independent)
- ⬜ 🔨 `@zerosky/offline` (46 tests) — durable Prisma-over-SQLite sync queue, 3 conflict strategies. ✅ Verifier note: `SyncMeta` pull-cursor is unwired scaffolding (pull direction TODO — the only stub found, an unbuilt feature, not a fake one)
- ⬜ 🔨 `@zerosky/payments` (66 tests) — integer paise, Razorpay HMAC-SHA256 `timingSafeEqual`, state machine, split tender, refunds. ✅ Verifier: confirm no float money path
- ⬜ 🔨 `@zerosky/print` (84 tests) — ESC/POS bytes (ESC=0x1b, GS=0x1d, cut `[GS,0x56,0x41,0x03]`), GST `cgst+sgst===tax` invariant, receipt/KOT/invoice templates. ⚠️ **DECISION NEEDED:** old plan locked print (and offline) as **Rust**; both were built in **TypeScript**. Either ratify TS as the decision or plan a Rust port — do not leave the plan contradicting the code
- ⬜ ✅ Verifier: run each suite 2–3× in different orders; confirm cross-package build still green

### Step 5 — Clean up
- ⬜ 🔨 Delete `orchestrator/*` branches (0 commits ahead, empty)
- ⬜ 🔨 Delete stray `coverage/` folders on working trees; add to `.gitignore` if not already
- ⬜ 🔨 Rename `feat/offline-package` → `feature/offline-package` for naming consistency
- ⬜ ✅ Reconcile the two plan docs into this single source of truth; delete/redirect `.agents/qa/QA-REPORT.md` (contains the false phantom claim)

### Step 6 — First app: `apps/pos-web` (only after Steps 1–3 on main)
- ⬜ Next.js 14 App Router + Tailwind + shadcn/ui
- ⬜ Login (email+password + PIN) against merged `@zerosky/auth`
- ⬜ Protected routes, menu display (read-only), cart UI
- ⬜ Order create → KOT → bill → pay against merged `@zerosky/api`
- ⬜ ✅ Verifier: e2e happy path on seeded DB

---

## From-scratch buildability

Anyone should be able to clone `main` and reach a working core by following Steps 1–4 (all merges) then Step 6. Until the merges happen, `main` builds only the skeleton + database. **The single highest-leverage action is Step 1 + Step 2: land the CI gate, then merge auth.** Everything else unblocks from there.

---

## Reference repos (study only — do NOT fork/vendor)

ury-erp/ury · ahmedali5530/restaurant-pos · satisfecho/pos · FreeOpenSourcePOS/FloCafe. Use for pattern reference; the code in this repo is owned and original.
