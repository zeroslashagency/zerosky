# 📋 ZEROSKY — QUICK START GUIDE

**Date:** 2026-07-21
**Status:** Packages real & verified by execution — mergeable AFTER the CI generate-step fix (below)
**Timeline:** ~1 week to MVP once merged

---

## 🎯 THE TRUTH (verified by actually RUNNING the tests)

Every count below was produced by executing `vitest run` in an isolated worktree — not by reading files. Prior docs (including earlier versions of this one) counted statically and inflated the totals.

### What you have
- ✅ **6 backend packages** (database, auth, api, offline, payments, print) — all REAL, no stubs
- ✅ **5,067 lines** of production code (LOC figures were accurate)
- ✅ **259 tests passing** when built correctly — **NOT 333** (that number was inflated; there are zero `.each` blocks, so static call-count = runtime count)
- ✅ All on feature branches, **none merged to main**

### Executed test counts (the real ones)
| Package | Prior doc claimed | **Executed (real)** | Clean-checkout result |
|---|---|---|---|
| auth | 34 | **28 ✅** | green out of the box |
| api | 46 | **35 ✅** | green out of the box |
| offline | 58 | **46 ✅** | ❌ FAILS until `prisma generate` runs (pinned 5.22) |
| payments | 81 | **59→66 ✅** | ❌ FAILS until `prisma generate` runs (pinned 5.22) |
| print | 114 | **84 ✅** | green out of the box |
| **TOTAL** | **333** | **259 ✅** | 2 of 5 need the generate step |

### Project status
- **Completion:** ~40% of backend (6/7 packages exist), but **0% integrated** — nothing is merged to main
- **Timeline to MVP:** ~1 week *after* the merge sprint below succeeds

---

## 🔴 CRITICAL PRE-MERGE FIX (do this FIRST or CI goes red)

`offline` and `payments` import a **generated Prisma client** (`../generated/client`) that does not exist until `prisma generate` runs. The `test` script is bare `vitest run` — it does **not** generate the client — so a clean `npm test` in CI FAILS on those two packages.

**This is already fixed in the working tree's `turbo.json`** (verified: both packages go green via `turbo run test`):

```jsonc
// turbo.json — the test/typecheck tasks now trigger client generation
"db:generate": { "cache": false, "outputs": ["generated/**"] },
"test":      { "dependsOn": ["^build", "^db:generate", "db:generate"], "outputs": ["coverage/**"] },
"typecheck": { "dependsOn": ["^build", "^db:generate", "db:generate"] }
```

**Also pin the CLI:** package-local `prisma` is 5.22.0; `npx prisma` pulls 7.x which silently emits nothing. Always use the workspace-local binary (turbo does this automatically via the `db:generate` script). Do NOT run a global/`npx prisma generate`.

Verified via the real CI path: `turbo run test --filter=@zerosky/payments` → 6 files pass; `--filter=@zerosky/offline` → 5 files pass.

---

## 🚀 THE MERGE SPRINT (gated, one package at a time)

**Gate rule:** after each merge, a *different* reviewer confirms tests actually ran green in CI before the next merge. Re-run suites 2–3× in different orders to catch shared-DB/order coupling (offline + payments share the Prisma client).

### Step 0 — Land the CI gate + generate fix on main FIRST
```bash
cd /Users/xoxo/Documents/resreah/billing/zerosky-repo
git checkout feature/api-package
git add .github/workflows/ci.yml turbo.json package.json
git commit -m "ci: run tests in CI + generate prisma client before test/typecheck"
```

### Step 1 — Merge API → main
```bash
git checkout main && git pull origin main
git merge feature/api-package --no-ff -m "feat: merge @zerosky/api + CI test gate"
npm install && npm test   # expect 35 api tests green
git push origin main
```

### Step 2 — Merge Auth (28 tests)
```bash
git merge feature/auth-package --no-ff -m "feat: merge @zerosky/auth (JWT, bcrypt, RBAC, 28 tests)"
npm test   # expect 28 auth tests green
git push origin main
```

### Step 3 — Merge Offline (46 tests) — generate step now matters
```bash
git merge feat/offline-package --no-ff -m "feat: merge @zerosky/offline (SQLite sync, 46 tests)"
npm install
npm test   # turbo runs db:generate first → expect 46 offline tests green
git push origin main
```

### Step 4 — Merge Payments (66 tests) + Print (84 tests)
```bash
git merge feature/payments --no-ff -m "feat: merge @zerosky/payments (Razorpay, paise, 66 tests)"
npm test   # expect 66 payments tests green (db:generate runs first)
git merge feature/print-package --no-ff -m "feat: merge @zerosky/print (ESC/POS, 84 tests)"
npm test   # expect 84 print tests green
git push origin main
```

### Step 5 — Final verification + cleanup
```bash
npm install && npm test && npm run typecheck && npm run build   # expect 259 tests total green
git branch -d feature/auth-package feat/offline-package feature/payments feature/print-package feature/api-package
git push origin --delete orchestrator/api-package orchestrator/auth-package orchestrator/offline-package  # empty scaffolds
```

**Success = 259 tests passing on main, CI green, build clean.** If any suite reports a different number, STOP and investigate — do not update the docs to match a number you didn't execute.

---

## ⚠️ UNRESOLVED DECISION
The old plan (`ZEROSKY_BUILD_PLAN.md`) locked **print and offline as Rust**; both were built in **TypeScript**. Either ratify TypeScript as the decision or plan a Rust port — do not leave the plan contradicting the code.

---

## 📁 KEY DOCUMENTS
1. **`Zerosky POS - Complete Development Roadmap & Pipeline.md`** ⭐ — the corrected authoritative roadmap (merge topology, dual-agent gates, verified feature/test table)
2. **`.agents/qa/BRANCH-VERIFICATION-REPORT.md`** — branch-by-branch detail (⚠️ its test totals were static/inflated — trust the executed 259 above)

### Superseded / contains errors
- ~~`CURRENT_POSITION_AND_NEXT_STEPS.md`~~ — the "phantom packages / rm -rf them" claim is FALSE and would delete real code
- ~~`VERIFICATION_COMPLETE.md`~~ — repeats the inflated 333 count
- `.agents/UNIFIED-ROADMAP-2026-07-22.md` — referenced by other docs but **does not exist on disk**

---

## 🚨 IF TESTS FAIL AFTER MERGE
```bash
npm install
# Regenerate with the PINNED cli via the workspace, NOT npx (npx pulls incompatible prisma 7):
npm run db:generate --workspace=@zerosky/database
npm run db:generate --workspace=@zerosky/offline
npm test -- --reporter=verbose
```
If you see `Failed to load url ../generated/client` — that is the generate step not having run. It is a build-order issue, not broken code.
