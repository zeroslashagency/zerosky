# Zerosky — Status and Plan

Last verified: 2026-07-27. Every claim below was checked against the code, the
database, or a command run in this repo. Where something is unverified it says so.

Verification baseline for this document:

| Check | Command | Result |
| --- | --- | --- |
| Unit/integration tests | `npx turbo run test` | **503 passed, 0 failed** (8/8 tasks), three consecutive runs identical |
| — by package | | api 192 · print 84 · ui 67 · payments 66 · auth 48 · offline 46 |
| Types | `npx turbo run typecheck` | 10/10 tasks successful; `apps/pos-web` `tsc --noEmit` also clean |
| Build | `npm run build` (pos-web, `--webpack`) | compiled in 13.2s, 20/20 static pages, 19 routes |
| E2E | `npm run test:e2e` (Playwright) | 18 specs; auth, money path, theme, axe a11y |
| Migrations | `npx prisma migrate status` | 4 migrations, up to date, zero drift |
| Git | `git log -1` | working tree **uncommitted** |

The unit count went 283 → 428 → **503**. The latest jump is the Tier 1/Tier 2
feature work in §6: shift lifecycle, discounts, table operations, and the print
integration. A Playwright E2E suite lives in `e2e/` — see §4.

**Test stability was fixed, not just observed.** `packages/api` has 19 test files
sharing one Postgres database, and several exercise bcrypt, which is CPU-bound by
design. Running files in parallel made them contend and time out at random while
passing perfectly in isolation. `packages/api/vitest.config.ts` now pins
`pool: "forks"`, `singleFork: true`, `fileParallelism: false`, and a 30s timeout.
The whole suite still finishes in about 15 seconds, and three consecutive full
runs are now byte-identical. A flaky suite is worse than a slow one.

---

## 1. Before / After / Next

### 1.1 Correctness of the money and order flow

| Area | Before | After | Next |
| --- | --- | --- | --- |
| Login password check | Any password was accepted | `verifyPassword` bcrypt compare, 5 tests | Rate-limit lockout after N failures |
| Order → table link | `order.create` never occupied the table | Occupies inside a transaction, validates the table belongs to the branch | Table transfer / merge |
| Order cancel | Table stayed OCCUPIED forever | Released only when no other live order holds it | — |
| Payment settlement | `payment.record` inserted a row and nothing else, so paid orders stayed `SENT_TO_KITCHEN` and revenue never reached reports | Aggregates CAPTURED payments, flips the order to PAID, frees the table — all in one transaction | Refunds through the UI |
| Bill totals | Bill read the Zustand cart, which `order.create` clears, so saved orders printed ₹0.00 | Reads persisted order lines via a `lines` prop | — |
| Service charge | Client-only hardcoded 5% that was never stored: bill said ₹547.80 while the payment charged ₹522.90 | Opt-in, defaults to off, so the bill and the charge agree | Store it on the order if it is ever enabled |
| `/orders/create` | Hardcoded `branchId: "default-branch"` → 404s and a stuck "Loading tables…" | Real `useBranch()`, honours `?tableId=` from the floor plan | — |
| Bill table label | Printed the raw cuid | Prints the table name | — |

### 1.2 Speed

| Area | Before | After | How measured |
| --- | --- | --- | --- |
| `reports.salesSummary` | Loaded every order row into memory | `aggregate()` + `groupBy()` | 22.283 ms → 0.476 ms; ~18 KB → ~150 B payload |
| React Query cache | `staleTime: 5s` — refetched constantly | 2 min stale, 10 min gc, retry 1 | Fewer network round-trips per navigation |
| Branch lookup | Refetched on every page navigation | 30 min stale, 60 min gc, no refetch on focus | Removed the per-navigation waterfall |
| Report queries | Composite indexes existed only in the local DB, absent from the schema | Declared in `schema.prisma` + a real migration | `prisma migrate status` clean |
| Rate limiter | `setInterval`-free map that grew forever | 5-minute sweep of expired buckets, `unref()`ed | Memory leak closed |
| Render loop | An inline `new Date().toISOString()` query key fired 962 requests | `useMemo` | 962 → 4 requests |

### 1.3 Theme and UI

| Area | Before | After | Next |
| --- | --- | --- | --- |
| Design tokens | Hardcoded Tailwind colours everywhere | `packages/ui` with 57 semantic HSL tokens per mode, `:root` + `.dark` | Named palettes (see §2) |
| Hardcoded colours | 285 utilities | 29, of which 21 are deliberate print exceptions (a thermal receipt must stay white) | Convert the 3 remaining gray status entries |
| Dark mode | Did not exist | Light / Dark / System toggle in the header, no-flash pre-paint script, localStorage `zerosky-theme` | — |
| Named palettes | Did not exist | 8 palettes (default, ocean, forest, sunset, midnight, emerald, cherry, slate) × light/dark as `[data-palette]` blocks, keyboard-navigable picker + mode control in Settings → Appearance, `zerosky-palette` persisted by the pre-paint script | Persist per-user on the server (T7) |
| Invisible text | `prefers-color-scheme: dark` flipped `--foreground` on hardcoded-light surfaces | Fixed in 62 places across 17 files, verified by screenshot | — |
| Table cards | Light-only fills → `P1`/`T1`/`T3` went white-on-white in dark mode | Every state pairs its own bg + text + border with `dark:` variants | — |
| Contrast | Unmeasured | background/foreground 19.99:1 light, 19.09:1 dark; destructive and muted-foreground raised to clear 4.5:1; primary-on-primary-tint surfaces switched from `bg-primary/10 text-primary` (as low as 2.47:1 in some palettes) to `bg-primary-100 text-primary-800` (≥5.05:1 across all 8 palettes × both modes) | — |

### 1.4 Structure and deployment

| Area | Before | After | Next |
| --- | --- | --- | --- |
| Root docs | 27 throwaway status files (`ALL_TASKS_COMPLETE.md`, `DAY*`, `MERGE_*`) | `README.md` + `LICENSE` + configs | — |
| `docs/` | Ad-hoc | ARCHITECTURE, DEPLOYMENT, DEVELOPMENT, SECURITY, ROADMAP, MOBILE | — |
| Migrations | None at all — the project used `db push`, so `migrate deploy` would have failed | `0_init` baselined + one index migration | — |
| Docker | Nothing | Dev compose, prod compose (Postgres/Redis internal-only, secrets required with no defaults), multi-stage non-root Dockerfile | Reverse proxy + TLS, `.env.example` |
| KDS app | A ~2000-line fork of pos-web | 5,662 lines removed, focused KDS on port 3002, PIN login, default-deny middleware | — |
| Mobile | React Native only | Flutter scaffold in `apps/mobile` + `docs/MOBILE.md`, RN kept until parity | Reach parity, then remove `apps/mobile-app` |

---

## 2. The theme plan — DONE (T1–T6, T8)

**Shipped.** `apps/pos-web/app/settings/page.tsx` now has an **Appearance**
section: a Light/Dark/System segmented control plus a keyboard-navigable palette
picker (ARIA radiogroup) with a live preview. Mode and palette compose as
independent axes — `.dark` class for mode, `data-palette` attribute for palette —
and both are restored before first paint by the inline script in `app/layout.tsx`
(`zerosky-theme` + `zerosky-palette`). The eight palettes are implemented as
`[data-palette]` / `.dark[data-palette]` blocks in
`packages/ui/src/styles/theme.css`.

Contrast (T6) is enforced by assertion, not by eye: `packages/ui/tests/palette.test.ts`
computes real WCAG ratios from theme.css for every palette in both modes,
covering destructive, muted-foreground, primary/primary-foreground, and the
primary-text-on-primary-tint pair used across the app.

**Still open: T7** — persisting the choice per user on the server so it follows a
user across devices. Today the choice is per-device in localStorage.

Original context, kept for the record:

`apps/pos-web/app/settings/page.tsx` previously had no theme
section at all — it was a read-only page showing tenant, branch and user. The
only theme control was the Light/Dark/System toggle in the header, with **no
named-palette picker anywhere.**

One honest note on the reference: URY has *less* than we do. It has no theme
picker, no named palettes, and no settings page in its POS frontend at all —
config lives in the ERPNext admin, and its theming is a plain
`prefers-color-scheme` media query. So for this feature there is no reference
pattern to copy. Petpooja's swatch picker is the model, and the design decisions
are ours.

### What makes this cheap

Every component already consumes `hsl(var(--primary))` style tokens. A palette
only needs to redefine the colour identity, not the surfaces:

- `--primary` + `--primary-50…950` — 13 tokens
- `--accent` + `--accent-50…950` — 13 tokens
- `--ring` — 1 token

That is **27 tokens per palette**, and **zero component rewrites**.

### Proposed shape

```css
/* mode stays a class, palette becomes an attribute — they compose */
.dark                          { /* existing 57 surface tokens */ }
[data-palette="ocean"]         { /* 27 light-mode identity tokens  */ }
.dark[data-palette="ocean"]    { /* 27 dark-mode identity tokens   */ }
```

Storage: `zerosky-theme` keeps the mode; a new `zerosky-palette` holds the name.
Both applied by the existing pre-paint script so there is still no flash.

Eight palettes are realistic before per-palette WCAG auditing becomes the
bottleneck: Default (blue), Ocean, Forest, Sunset, Midnight, Emerald, Cherry,
Slate.

### Work breakdown

| # | Task | Files | Status |
| --- | --- | --- | --- |
| T1 | Add `data-palette` blocks, 8 palettes × 2 modes | `packages/ui/src/styles/theme.css` | done |
| T2 | Extend `ThemeProvider` with `palette` / `setPalette` | `components/theme/theme-provider.tsx` | done |
| T3 | Extend the pre-paint script to apply the palette attribute | `app/layout.tsx` | done |
| T4 | New `<PalettePicker>` — swatch grid, keyboard-navigable, live preview | `components/theme/palette-picker.tsx` | done |
| T5 | Wire an **Appearance** section into Settings: mode segmented control + palette grid | `app/settings/page.tsx` | done |
| T6 | Clear 4.5:1 on destructive/muted, primary-on-tint, per palette per mode | `theme.css` | done |
| T7 | Persist the choice per user on the server so it follows them across devices | `schema.prisma`, `auth` router | **not started** |
| T8 | Tests: palette applies, persists, survives reload; contrast assertions | `packages/ui/tests/palette.test.ts`, `e2e/theme.spec.ts` | done |

Only T7 remains; it touches the schema.

---

## 3. What is still missing

### 3.1 No-op buttons — controls that render but do nothing

| Page | Control | Evidence |
| --- | --- | --- |
| `/reports` | Export | `reports/page.tsx:80`, no `onClick` |
| `/partners` | Add Partner | `partners/page.tsx:62-64`, no handler |
| `/partners` | Edit / View | `partners/page.tsx:185-189`, ghost buttons |
| `/partners` | View performance | `partners/page.tsx:263-265`, calls `console.log` |
| `/inventory` | Add Item | `inventory/page.tsx:70-71`, no handler |
| `/inventory` | Edit | `inventory/page.tsx:179-181`, ghost button |
| `/settings` | everything | read-only by design, no editing |
| `/staff` | no add/edit exists | list only |

### 3.2 Built but never connected

| Thing | Reality |
| --- | --- |
| `@zerosky/offline` | Full sync engine, 46 tests, **0 imports** in any app |
| `@zerosky/print` | ESC/POS driver, 84 tests, **0 imports** in any app |
| `@zerosky/payments` | Razorpay + refunds + webhooks, 66 tests, **0 imports** in any app |
| `purchaseOrder` router | 6 procedures, 0 callers |
| `supplier` router | 5 procedures, 0 callers |

### 3.3 Security — mostly closed

The raw-`user.id`-as-token hole is **fixed and wired in**. `packages/api/src/context.ts`
now resolves a request by (1) verifying a signed, unexpired access JWT with the
correct `type` claim, then (2) confirming the embedded session id still exists in
Redis, and (3) rejecting a token whose claims disagree with the stored session.
This is exercised by the `session-auth` suite (19 tests: issue, expiry, tamper,
revoke, refresh rotation). The `auth_token` cookie is httpOnly, and seeded PINs
are bcrypt-hashed (`seed.ts` hashes both PINs and passwords).

Remaining: no rate-limit lockout after N failed logins (§1.1 "Next").

### 3.4 Feature gaps against the reference (URY): 16 done, 15 partial, 40 missing

Shift lifecycle (POS Opening / Sub Closing / Closing Entry and the day-gate) ·
table transfer, captain transfer, table merge, bill merge, bill split · KOT diff
logic (initial vs modified vs partially-cancelled) and multi-kitchen production
units · recipe/BOM, product bundles, COGS · Daily P&L and 8 of the 14 named
reports · the print transport layer (QZ Tray → CUPS → websocket) ·
profile-level permission toggles and branch/room user scoping.

---

## 4. Test and deploy scorecard

Scores are `verified tests ÷ what the area needs`. They are judgements, but each
one is anchored to the counts below.

| Area | Automated tests | Manually walked in a browser | Score | Why not higher |
| --- | --- | --- | --- | --- |
| `packages/print` | 84 | n/a | 95% | No physical printer ever attached |
| `packages/payments` | 66 | n/a | 90% | No live Razorpay sandbox call |
| `packages/api` | 59 (real Postgres) | via the UI | 85% | `inventory`, `partner`, `reports`, `supplier`, `purchaseOrder` routers untested |
| `packages/offline` | 46 | never — unimported | 80% logic / **0% integrated** | Nothing in the app imports it |
| `packages/auth` | 28 | n/a | 80% logic / **0% integrated** | JWT + sessions unwired |
| Order → payment flow | 10 settlement tests + Playwright money path | **yes, twice, end to end** | 92% | See the walkthrough below |
| `/dashboard` `/menu` `/tables` `/orders` `/kitchen` `/billing` | E2E money path + auth | yes | 78% | Covered by Playwright; no React component unit tests |
| `/reports` `/staff` `/inventory` `/partners` `/settings` | E2E for /settings appearance | opened, not exercised | 45% | Stub buttons never clicked because they do nothing |
| Theme / palette system | 67 assertion tests + E2E persistence | yes, screenshot-verified | 90% | Server-side per-user persistence (T7) not built |
| `apps/kds-display` | 0 | not since the rewrite | 30% | Rewritten and re-authed, then never re-walked |
| `apps/mobile` (Flutter) | 6 | no | 15% | Scaffold only |
| `apps/mobile-app` (RN) | 0 | no | 5% | Placeholder |
| Docker prod deploy | compose validates | **never actually deployed** | 25% | No container has been run |
| Vercel | none | never | 0% | Documented only |

**Totals: 428 automated unit/integration tests, all passing (up from 283). A
Playwright E2E suite now exists (`e2e/`) covering auth, the money path, theme +
palette persistence, and axe-core WCAG smoke checks in light and dark mode. 0
React component (render) tests still. CI runs lint, typecheck, test and build
against real Postgres and Redis, but still has no deploy step.**

### What was walked by hand, in a real browser

Two complete loops with dark-mode emulation on:

1. Order `ORD-MRZQ8BFN` — ₹498 + ₹24.90 GST = ₹522.90, matching Postgres
   exactly. Bill preview corrected from ₹0.00 to real lines with CGST/SGST
   ₹12.45 each. `KOT-MRZQCAF3` generated, appeared on `/kitchen`, marked READY,
   confirmed in the DB. UPI payment captured.
2. Order `ORD-MRZQLCPZ` on table T3 — table flipped OCCUPIED, cash ₹300 tendered
   against a ₹240.45 bill, change ₹59.55 computed, order went **PAID**, table
   freed, dashboard showed 1 order / ₹240.45 / avg ₹240.45.

### What I want to test next, in priority order

1. **Actually run `docker-compose.prod.yml`** and hit the health check. A
   validating compose file is not a working deployment.
2. **Router tests** for `inventory`, `partner`, `supplier` (`reports` now has 13).
3. **React component (render) tests** — the theme token pairs are covered by
   assertion and E2E, but no component renders under test yet.
4. **Re-walk `apps/kds-display`** — it was rewritten and never re-verified.

Done since the last revision: Playwright E2E over login → menu → order → KOT →
payment → dashboard (§4), plus theme and axe-core coverage.

---

## 5. Recommended order of work

| Phase | Work | Status |
| --- | --- | --- |
| A | Theme section in Settings, T1–T6, T8 | **done** |
| B | Database-driven modifiers | **done** — modal is DB-driven from seeded `ModifierGroup`/`Modifier` (Spice Level, Portion Size, Add-ons on Paneer Tikka, Butter Chicken, Dal Makhani); items with no groups skip the modal |
| C | Wire JWT + Redis sessions | **done** — resolved in `packages/api/src/context.ts`, 19 session tests |
| D | Finish the no-op buttons, or remove them | partial — dead notification bell removed from the header; export/add/edit stubs on reports/partners/inventory remain |
| E | Playwright E2E | **done** (§4); a real Docker deploy is still not run |
| F | Shift lifecycle, then table transfer / merge / split | **DONE — see §6** |

Remaining, in priority order: T7 (per-user server-side theme persistence), a real
Docker deploy, Razorpay wiring, and the offline engine.

---

## 6. Tier 1 and Tier 2 feature work (2026-07-27)

Built to close the largest gaps found in the Petpooja comparison
(`docs/COMPETITIVE-ANALYSIS.md`). Migration
`20260727120000_add_shifts_and_discounts` is purely additive — every new column
is nullable or defaulted, so no existing row was at risk.

### Shift / day lifecycle — the biggest gap, now closed

A `Shift` model with `open`, `current`, `close`, `summary`, `report`, and `list`.
Opening records the counted float; closing computes
`expectedCash = openingCash + captured cash − cash refunds`, snapshots it, and
stores `variance = counted − expected` so later edits cannot rewrite history.
Closing is refused while live orders remain on the shift, naming the count.

Two implementation notes worth keeping:

- **Concurrency.** "Exactly one open shift per branch" is a predicate, not a
  unique column, so read-committed lets two cashiers both see an empty table and
  both insert. Serializable isolation catches it but aborts on any transaction
  touching the same index range — unrelated branches included — turning an
  unlucky moment into a failed till open. The fix is a transaction-scoped
  advisory lock keyed on the branch, which blocks only the genuine contender.
- **The day-gate is what makes the feature real.** `order.create` and
  `payment.record` stamp the open till's `shiftId` via a shared
  `resolveOpenShift` helper. Without it a cashier could trade all day and close
  to a perfect ₹0 variance, because nothing pointed at the shift.
  `packages/api/tests/day-gate.test.ts` proves this end to end through the real
  procedures; sabotaging the stamp turns 3 of its 6 tests red.

Deliberately **not** a hard gate: a branch that never opens a till still bills
normally, its rows just carry `shiftId: null` and fall outside reconciliation.

### Discounts — the column that nothing wrote

`order.applyDiscount` / `order.removeDiscount`, restricted to
OWNER/MANAGER/CASHIER, plus per-line `OrderItem.discountAmount`. Stores type
(PERCENT/FLAT), value, reason, and which user applied it, so a bill reprinted
months later still explains itself.

**GST is charged on the discounted value**, so the discount reduces the taxable
base rather than being subtracted after tax. Worked example — 4 × ₹100, 5% GST,
10% off:

```
subtotal      = 400
discountTotal = 40        (400 × 10%)
taxable base  = 360
taxTotal      = 18        (360 × 5%)   ← not 20
grandTotal    = 400 − 40 + 18 = 378
```

Taxing first would collect ₹2 of GST on money the customer never paid.

`bill-preview.tsx` renders the **persisted** order and recomputes nothing. That
is deliberate: a client-only service charge once made the bill say ₹547.80 while
the payment took ₹522.90.

### Table operations

`table.transferOrder` (validates both tables, refuses an occupied destination,
releases the source only when no other live order holds it), `table.mergeOrders`
(moves lines onto a primary order, recomputes totals from the lines rather than
trusting stored ones, releases vacated tables), and `payment.splitBill` — by
amount or by the existing `OrderItem.seat` field. Split parts must sum to
**exactly** the grand total; the residual lands deterministically on the last
part, and a test proves ₹100 across 3 ways loses no paise.

### Print — 84 tests, previously zero imports

A `print` router (`printKot`, `reprintKot`, `printBill`, `openCashDrawer`,
`listPrinters`) with a transport chosen by env (`mock` default, `network`
implemented, `usb` still a stub). Print buttons on `/kitchen` show `printedAt`,
and a reprint is flagged as such on the ticket. A print failure returns a clear
error and **never rolls back the KOT** — printing is a side effect, and a paper
jam must not lose an order. See `docs/PRINTING.md`.

**Honest limitation: no physical printer has ever been attached.** Only the mock
transport is verified. Paper width, character encoding, and the drawer pin are
all unverified against real hardware.

### Verified in a browser

Logged in, opened a till with a ₹1,000 float, and confirmed the live drawer panel
and the "card/UPI never enter the drawer" note. Queried Postgres directly to
confirm the `shifts` row and every new `orders` column and index.

---

One thing still needs your decision:

- The working tree is **uncommitted.** Everything in §1 and the theme/modifier/
  session/E2E work above sits in the working tree. Nothing is lost, but nothing
  is saved either.
- **`restaurant-pos/zerosky-backup` is a stale decoy copy.** It should be
  deleted, but that will not happen without your say-so.
