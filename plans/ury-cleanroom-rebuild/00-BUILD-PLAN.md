#ZeroskyClean-Room Build Plan — Reimplementing ury's Proven Flows ina Lean TypeScript Stack##Legal method (readfirst)

Thisisa **clean-room, spec-driven**rebuild. We reuse the *featuresandflows* of ury (a restaurant POS), whichare **free toreuse** — functionalbehavior, workflows, and business rules arenot copyrightable.We do **not** reuseury's *code orexpression*, which is licensed AGPL-3.0 and wouldvirallyrelicense any derivative.Method:
- Every phase belowbuilds againsta**behavior spec** (the 5 extracted specs),authored from observed behavior, **withthe ury source closed**.Noury Python/Frappe sourceis opened, pasted, transliterated, or referenced duringimplementation.
- Implementersworkonlyfrom thespec documents inthis plan. Ifaspec is ambiguous, resolve byproductdecision orblack-box observation — neverby reading ury code.
-Zerosky stays **MIT**. BecausenoAGPL code enters thetree, the license stays clean and the flows remainours toship (including asSaaS).

**AGPL §13flag (SaaS trigger):** AGPL'snetworkclause meansthat *running*modified ury code asa hosted service — notjustdistributing it — obligates you to releasethe complete corresponding source under AGPL. Anycopy-paste, port,or line-by-line translation of ury code intoa hosted Zerosky would trigger §13 and relicense ourstack. Thisplan avoids §13 entirelyby building fromspecs: weowneveryline,so thereis no "corresponding source" obligation andno relicensing.---

## Target leanstack

| Concern |Zerosky (lean) | ury (heavy) |
|---|---|---|
| App/API| Next.js 16+ tRPC v11(onedeploy) | Frappe web+REST +workers |
|ORM /DB |Prisma + PostgreSQL |FrappeORM + MariaDB|
| Offline | SQLite (client sync,`packages/offline`)| —/external |
| Real-time| oneSSE/WebSocketgateway (addedin Phase 4) |Redis +socketio + queue workers |
| Background jobs | in-process scheduler /lightweight queue | Redis +RQworkers + scheduler |
| Print| `packages/print` (ESC/POS,USB/network) | print server/CUPS chain |
| License | **MIT** | **AGPL-3.0** |

**Servicecount:werun 2–3 processes** (Next.js app,Postgres, optional realtime/worker) **vs ury's 7+** (web, MariaDB,Redis-cache, Redis-queue, Redis-socketio, RQ workers, scheduler, socketio node). Sameflows, afraction of the operational surface.

---

## Phaseordering (dependency-driven)Derived from the gap analysis. **Complete PARTIALsubsystems first wheretheyunblock others, then greenfield MISSINGones, in build order:**

`auth/permissions → menu-resolution → orderlifecycle → KOT/KDS → inventory/recipe/COGS → shift/reconcile → multi-outlet → analytics/P&L`Cross-cutting prerequisites that gate everything downstream (fromthe gap analysis)are pulled forward:the**Shift model**, **orthogonal statemarkers**, and**per-profile permission toggles** are foundational schema/RBAC work, so they landinPhases0–1and earlyPhase 3.

---### Phase 0— Foundationalschema & RBAC (unblocks all)

**Whyfirst:** Fivecross-cutting gaps(noShift model, flat single-enum states, coarse permissions, noProductionUnit/Course/menu-resolution entities,no realtime)blockmultiple specs. Theschema-migration andpermission pieces areprerequisites,so theygofirst.

-**Build:**- Add`Shift` /`ShiftOpening` model(status Open/Closed, per-methodopening floats) — unblocksSpec 1§5.1gate, Spec 2ordinal numbering, Spec 4,Spec 5P&L anchoring.- Introduce **orthogonalstatemarkers**: keep `OrderStatus` as document-state but add aone-way `isBilled`/`billedAt` marker (Spec 1); split `KotStatus` into `kind` ×`serviceStatus` × `verified` (Spec2).This is a schema migration,not a codetweak.
  - Extend RBAC fromthe5-roleladder to **per-terminal-profile toggles**: `rolesAllowedToBill`, `viewAllStatuses`, `editAfterBill`, transfer permissions, plusbranch/room record-scoping.
- **Extend:** `packages/database/prisma/schema.prisma` (models`Order`~276-306, `Kot`~335-352, enums~43-68); `packages/auth/src/rbac.ts`(addprofile-toggle layer above`roleProcedure`).
- **Spec:** cross-cutting §permissions ofall5 specs; Spec 1 §4.1/§6,Spec 2§3/§7, Spec4 (full).
- **Verify/parity:** migration applies cleanly; existing `order`/`kot`procedures compile againstnew fields; a WAITER isdenied bill, a CASHIER ona profile with`rolesAllowedToBill` isallowed; record-scoping unit tests pass.---

### Phase1 — Auth &permissionenforcement (PARTIAL → complete)

**Build:** wire thePhase-0 profile toggles into procedureguards;replace hardcoded bill-roles in`payment.ts` with profile-configurable `rolesAllowedToBill`; addbranch/room scoping middleware.

- **Extend:** `packages/api/src/routers/auth.ts`, `packages/auth/src/rbac.ts`, `packages/api/src/routers/payment.ts:13-38`.
- **Spec:** Spec 1§3 (billing-user auth), §6 rule permissions.
- **Verify / parity:** matrix test — eachrole ×each profile toggle →expected allow/deny; billing rejected when profile disables it evenforCASHIER.

---### Phase 2 —Menu resolution &multi-outlet catalog wiring (MISSING coreentities)

**Whyhere:** orderpricing/routing downstream needs area/order-type→menu resolution and aRestaurantProfile. Pulledahead of order coordination becausePhase 3 depends onit.

- **Build:** `RestaurantProfile`, area→menu and order-type→menu maps, price-listprojection,`ProductionUnit`/`KitchenStation` and`Course` entities (usedby Phases3–4). Aggregator customer/price-list/pay-mode binding resolution (Spec 1§6 rule 11).
- **Extend:** `schema.prisma` (`Menu` ~161gains resolution maps),`packages/api/src/routers/menu.ts`.
- **Spec:** multi-outletmenu-resolution spec; Spec 1 §6 rule 11.- **Verify / parity:** given(branch, area, order-type), resolver returns correct menu + price list; aggregator order binds branch-specific customer/paymode; defaultmenu still resolves whenno map exists.

---### Phase 3 —Order lifecycle coordination layer (PARTIAL~30% → complete)**Why:** cart/pricingis solid; the entire coordination layer is missing.This is the largest gap andgates KOT/KDS.

-**Build:**
  1. **Billed marker + settlement→PAID:** a`bill` mutation sets `isBilled`one-way; recording fullpayment moves order→PAID and clears provisionallines; stale-client"already billed" rejection (Spec 1§4.1 guard, §6 rule 3).
  2. **Tableoccupancy invariant:** auto-occupy onorder create, conditional/cluster-aware release on cancel/settle, derived time-based`Attention` (Spec 1§4.2).Wire into `order.create`.
  3. **State-machine guard:** replace any-status→any `setStatus` with thetwo-dimensional model; add CONSOLIDATED/RETURN document states.4. **Shift gate:** blockorder create whenno openshift (Spec 1§5.1,§6 rule 1)— usesPhase-0 `ShiftOpening`.5. **Merge/ split / transfer:** table-merge cluster fields, bill merge,bill split, table/servertransfer withKOT repointing andintra-branch/room constraints(Spec 1 §5.6, §6 rule 13).
  6.**Discounts**apply procedure + profile toggle; **occupancy contention** optimistic-lock/refresh prompt (§6 rule 6,§7).
- **Extend:** `packages/api/src/routers/order.ts` (`create`88-131, `addItems` 133-175, `setStatus`203-222, `cancel` 224-246), `table.ts` (`setState` 68-81), `payment.ts`, `packages/payments/src/{state,multi-tender}.ts`.- **Spec:**Spec 1 §4.1–§4.3, §5.1,§5.6, §6.- **Verify / parity:** order createoccupies table+fails withoutopen shift; payment settles→ PAID +tablereleased; second operator gets refresh prompt oncontendedorder; cancel frees table andissues full-cancel KOT (coordinates with Phase 4); merge/split/transfer preserve line+KOT integrity.---

### Phase 4— KOT routing + real-time KDS (PARTIAL ~20%→ complete)

-**Build:**
  1. **Dual-axis KOT lifecycle:** `kind`(New/Modified/Partial-cancel/Cancelled/Duplicate) derived bydiffing current-vs-previous items; `serviceStatus`, `verified`/`verifiedBy`, `servedAt`/`prepStartTime`+ duration, per-shiftordinal `orderNumber` with aggregatorprefix (Spec2 §3,§4.1, §7).
  2. **Station routing:**partition items by category→`ProductionUnit`/`KitchenStation` (Phase2entities);one KOT per station,not one per order (Spec 2 §4.3).
  3. **Serve/verify transitions**stamp times+ compute productionduration (§3.2, §3.3, §6 rule7).
  4. **Real-time display:** one SSE/WebSocket gateway,per-branch+station channel push(Spec 2 §6.1)— the lean stack's single realtime process.
  5. **Active-display query** (Ready+submitted+unverified,3h window, order-typefilter) (§6.1, §8).6. **Reconciliation safety-net job** (scheduled, emits Duplicate tickets, TicketErrorLog) (§4.6); full-order-cancel → Cancelled ticket + cancelsactives (§4.4); table-change repoint ofactive KOTs (§4.5);course/serving-priority onlines (§4.2).
  7. **Printcascade:** station→room→profile printer resolution, per-room/per-stationbindings, signed-bridge/CUPS/websocket transport (Spec 2 §5,§8).
- **Extend:** `packages/api/src/routers/kot.ts` (`create` 16-62, `list`/`setStatus` 64-113), `schema.prisma` (`Kot` 335-352,`OrderItem`),`packages/print/src/{index,discovery}.ts`, `templates/kot.ts`;new realtime gateway package.
- **Spec:** Spec 2 §3–§8.
- **Verify /parity:** adding itemsto asent order yields a *Modified* KOT (diff), nota duplicate New; itemssplit across correct stations; KDS pushes within~1s; reconciliation jobsurfaces adeliberately-dropped ticket asDuplicate; servedstamps duration;ordinal resets per shift.

---### Phase 5 —Inventory:recipe /BOM / depletion / COGS (PARTIAL ~25% → complete)

**Why here:** raw stock (adjustments, POs, valuation) is done; recipe→depletion→COGS is the spec's core valueand it blocks P&L (Phase 8).

- **Build:**1. **Recipe/BOM:** `Recipe` linking menu `Item`→`InventoryItem` ingredients, nesting, effective-recipe gate (Spec 3§2, R1–R3).
  2. **Automatic depletion onsale:** "affect stock" flag on order;recipe expansion decrements `InventoryItem` at settle;production-unit→warehouse binding fordepletion location (§3.1, R1, R8).
  3. **Bundles/combos** (stock-expanding, distinct from priced `Modifier`s) (R4); modifiers/variants resolvingto stocked catalog items +menu-membership validation (R9).4. **COGSroutine:** 3-bucket classify, recursive recipe,bundle, unpriced collection (§4, R5–R7);per-branch buying pricelist (R6); consumable-materials expense stream (R12).
- **Extend:** `packages/api/src/routers/inventory.ts` (CRUD5-106, adjust108-164reuse thetransactional pattern), `supplier.ts`, `purchaseOrder.ts`, `schema.prisma` (`InventoryItem` 382-411, `Item`193, `Modifier` 216-248).
- **Spec:** Spec 3 §2–§4, R1–R12.
- **Verify /parity:** selling a dish depletesingredients by recipe qty (incl. nested);bundle depletes components; COGS fora dayequals sum of per-lineingredient cost; negative-stock guard still holds;valuation reconciles withadjustments.

---

###Phase 6 —Shift close & cash reconciliation (MISSING~0% → build)

**Why here:** pure greenfield; depends onPhase-0 `ShiftOpening` andPhase-3 settlement.- **Build:** `OpeningFloatLine` per method; `SubPosClosing` withreconciliation lines (expected/counted/difference);`DayEndClosing` with aggregation; multi-cashier open/close-order invariants; day-boundary /prior-day-closeenforcement; closing backgroundstatemachine (Queued/Failed/Retry); field-level protection of expected/difference.Router + statemachine fromscratch.
- **Extend:** new`schema.prisma`models (ShiftOpening extensions, OpeningFloatLine, SubPosClosing, DayEndClosing +linked-txn children); new `packages/api/src/routers/shift.ts`. **Note:** `packages/payments/src/reconcile.ts`is *gateway*webhook↔txn matching — do **not** conflate itwith cash-drawer reconciliation.
- **Spec:** Spec4 (all sub-areas).
- **Verify/ parity:** expected =opening float+ settled cash forshift; counted vs expected yields difference; ashift can't close withopen orders; prior daymust closebefore newday opens; expected/difference arenon-editable;failed closingretries.

---

###Phase 7 — Multi-outlet coordination (finish)**Why here:** entities landed inPhase 2; this phase completes cross-outlet order/menu/print/scopebehavior nowthat lifecycle, KDS, inventory, and shifts exist.

- **Build:** branch/room record-scoping enforcement end-to-end;intra-branch transfer constraints (tiesPhase 3 transfer to realscoping); per-outlet profile defaults; aggregator per-branch bindings validated acrossoutlets.
- **Extend:** `rbac.ts`scoping middleware, `order.ts`/`kot.ts`/`menu.ts`scopefilters.
- **Spec:** multi-outletmenu-resolution spec+Spec 1 §6rule 13.
-**Verify / parity:** userscoped to Branch A cannot read/mutate Branch B orders; transfer blocked across branches,allowed intra-branch/room perpermission.

---

### Phase 8 — Analytics &Daily P&L (PARTIAL ~30%→ complete)

**Whylast:** thefinalized P&L isblocked onPhase-5 COGSand Phase-0/6 shift/day-boundary.

- **Build:**
  1. **Business-day boundary:** `ReportSettings` with configurable extended-hours cutoff; replace plain `createdAt` calendar windows (Spec 5§4.1).
  2. **Daily P&L statement:** COGS (from Phase 5) +expensemodel(electricity, depreciation, employee cost, attendance), gross/net profit +percentages (§3.1, §4.2); P&L lifecycleDraft→Submitted→Cancelled→Amended.3. **Densedateseries** for daily sales (zero-daysappear)and**12two-hour buckets** for time-wise(fix current24×1h)(§4.3).4. **Settled-onlycounting** incl. CONSOLIDATED status (§5rule 1).5. **Missing reports:** cancelled invoices, customer/repeat-customer (PII-gated), service-wise,month-wise, average-bill, employee-sales.
  6. **Role/PII gating:** restrict finance/PII reports to manager/finance (currently any`protectedProcedure`)(§7).
- **Extend:** `packages/api/src/routers/reports.ts` (`salesSummary` 6-71, `topItems` 74-131, `dailySales`134-197, `hourlySales` 290-339, `inventoryValuation`342-381), `apps/pos-web/app/reports/page.tsx`;new `pnl`/`reportSettings` routers;addEmployee/Attendance models.
- **Spec:** Spec 5 §3–§7.
- **Verify /parity:** P&L netprofit = revenue − COGS − expenses; late-night sales fall intocorrect business day percutoff; daily seriesshows zero-days; onlysettled orders counted; aWAITER isdenied P&L/PII reports.---

## BottomlineBuildury's proven restaurant flows clean-room from behavior specs — foundational schema/RBAC first, then complete the PARTIALorder/KOT/inventory/analytics subsystems and build the greenfield shift-reconciliation layer — landing a lean2–3service MIT stack thatowns everyline and never touches AGPL code.