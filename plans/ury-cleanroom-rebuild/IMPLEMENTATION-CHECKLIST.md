#ZeroSky POS — Clean-Room ImplementationPlan (Parity with ury flows)

## Legal methodClean-room implementation: buildeveryfeature belowfrom the writtenspecsand thischecklist only. Neverread, copy, paste, or adapt urysourcecode. Reproduce **behavior andflows**, not code. Thestack stays MIT-licensed; allnew codeis original workauthored against`spec-spec-{1..6}.md`.

## How to use this plan

-Every feature is twocheckboxes: `[] implement` then`[ ] test`.Donotcheck `implement` until the codecompiles;do not check `test` until thenamedtest is green.
- Workstrictly top-to-bottom. Phases are independency order —a laterphase assumes theschema and routers of earlier phases exist.
- Each phaseends with a **Verification gate**. Donot startthenext phase until thegate is fully green.
- "Already done" notes listverified-✅ coverage so you knowwhat toleave alone.

##Current baseline (ground truth)

-Typecheck passes;unit tests pass.- Integration/parity tests needaPostgres service and are currently **18skipped**.
- Money math (`packages/payments/src/money.ts`),split/state primitives (`multi-tender.ts`, `state.ts`), and priced order-create (`order.ts:priceLines`) are correct inisolation but **not wiredinto the API** — mostof thisplan is wiring +themissing domain models.

---

## Phase0 — Schema foundation,RBAC, andtest infraEverything downstream isblocked on missing models and anunenforced permission layer.Do this first.

**Alreadydone:** `UserRole` enum (OWNER/MANAGER/CASHIER/WAITER/KITCHEN);generic rank helper `rbac.ts` (`hasMinRole`/`hasExactRole`); tenant scoping on all existing routers;`Prisma.Decimal`money columns.###Test infrastructure

- [] **Wire a disposablePostgres fortests** — `docker-compose.test.yml` +`package.json` testscript (`docker compose -f docker-compose.test.yml up -d &&prisma migrate deploy`) — _test:_ `npm test` un-skips the 18 integration tests;CI jobspins thecontainer andruns `prisma migrate deploy` againstit.
- [ ] **Add a test DB reset helper** — `packages/database/src/test-utils/reset.ts` (truncate-all-tables betweensuites) — _test:_twointegration tests runback-to-back with no rowbleed (assert count===0 atstart of second).- [ ] **Adda seeded-tenant fixture factory** — `packages/api/src/test-utils/factories.ts` (tenant + branch + usersperrole + menu + item) — _test:_ factory returns callable tRPC context perrole; assert a WAITER context cannot callanOWNER-gated procedure.

### RBAC upgrade (per-feature matrix, branch scoping)

- [] **Add per-feature permission matrix**(bill, transfer, edit-after-bill, cancel, view-all-statuses, restricted-from-table-ordering, day-end-close, sub-close, pnl-submit, report-read) — `packages/auth/src/permissions.ts` — _test:_ unit tableasserting eachrole×feature boolean matches spec §3(order),§10(KOT), §7 (analytics),§7(shift).
- [ ]**Add `TerminalProfile` model** (roles-allowed-to-bill, transfer permission, restricted-from-table-ordering, view-all-statuses, edit-after-bill, cancel permission, multiCashier,dailyClose enforcement, main/sub-cashier designation, accepted payment methods) — `packages/database/prisma/schema.prisma` — _test:_ migration applies; `terminalProfile.get`returns defaults for a fresh branch.
- [] **Add per-user branch/room allow-list** (`UserBranchAccess`, `UserRoomAccess` join models) — `schema.prisma` — _test:_ a user scoped to branch A gets NOT_FOUND querying branch B's orders.- [ ] **Add a `branchScopedProcedure`** thatintersects tenant scope withthe user's branch allow-list — `packages/api/src/trpc.ts` — _test:_ integration test: userwithout accessto branch B cannot createanorder there.

### Missing domain models (createnow,wire in later phases)

-[ ] **Order: add`discountTotal`write path +billed marker + `roundOff`** — add`billedAt DateTime?`, `roundOffDecimal`, extend `OrderStatus` with`CONSOLIDATED`,`RETURNED` — `schema.prisma` — _test:_migration applies; enum round-trips in aPrisma query.
-[ ] **Table:add `occupiedAt`, `attentionSince`;extend `TableState` with `ACTIVE`/`ATTENTION`** — `schema.prisma` — _test:_migration applies.- [ ] **KOT: split single-axis enum into twofields** — add`kind`(`NEW|MODIFIED|PARTIAL|CANCELLED|DUPLICATE`)and `serviceStatus` (`SUBMITTED|READY|SERVED|CANCELLED`); add`verifiedBoolean`, `verifiedById`, `servedAt`, `prepStart`,`prepDurationMins`, self-relation `cancelsKotId` — `schema.prisma` — _test:_migration applies; a KOT can hold kind=MODIFIED & serviceStatus=SUBMITTED simultaneously.
- [] **KitchenStation +StationCategoryBinding + StationOrderTypeFilter+ PrinterBinding** — `schema.prisma` — _test:_migration applies; astation canbind≥1category.
- [] **Recipe + RecipeComponent +Bundle + BundleComponent + BuyingPriceList + BuyingPrice +Warehouse + COGSLine + ConsumableMaterial** —`schema.prisma`— _test:_ migrationapplies; a recipe canreference another recipe (nesting FK).
- [ ]**Item:add `isBundle`, `affectsStock`, `warehouseId?`, `special`;Modifier:add `sellableItemId?`; Variant model;Order: add `affectStock`, `warehouseId?`** — `schema.prisma` — _test:_migration applies.
-[ ] **Shift+ ShiftOpening + OpeningFloatLine + SubPosClosing + LinkedTransactionLine + PaymentReconciliationLine + DayEndClosing**— `schema.prisma` — _test:_ migration applies; ashift linksto abranch and an operator.
- [ ]**RestaurantProfile + ServingArea +AreaMenuMap+ OrderTypeMenuMap + Course + PriceList + PriceListLine**— `schema.prisma` — _test:_ migration applies; anarea can mapto a menu.
- [ ]**ReportSettings +DailyPnl + ExpenseConfig +Employee + Attendance +Customer** — `schema.prisma`; add`Order.customerId?` —_test:_ migration applies; an order can attach a customer.
- [] **Addper-branch sequence tables** (`OrderNumberSeq`, `KotNumberSeq`,`PONumberSeq`) toreplace `Date.now().toString(36)` —`schema.prisma`— _test:_ migrationapplies; unique constraint on `(branchId, kind)`.

### Verification gate —Phase 0- [ ] typecheck green
- [ ]`prisma migrate deploy` applies cleanly onthe test Postgres
-[ ] phase testsgreen (RBAC matrix, factories, branch scoping)- [ ] no regression in existing suites (existing unit tests stillpass againstnew schema)

---

##Phase 1 —Auth &shift gatehooks

Auth (PIN login, RBAC skeleton) alreadyexists (commit `4b9c558`). This phase onlyadds the hooks laterphases depend on.

**Already done:** PIN login,auth context, `roleProcedure`, tenant resolution.

-[ ] **Expose current-userpermissionset on`ctx.auth`** (resolveTerminalProfile + branch/room accessinto `ctx.auth.can`) — `packages/api/src/trpc.ts` — _test:_integration:`ctx.auth.can.bill` is false forWAITER, true for CASHIER whenprofile allows.
- [] **Add "active shift required" guard primitive** (`requireOpenShift`) thatlaterorder/KOT procedures compose — `packages/api/src/guards/shift.ts` — _test:_ unit: throws PRECONDITION_FAILED when no openshift;passes when one exists. (Actual shift modelwired in Phase 6;guard is a no-op-safe stub returning theopenshift orthrowing.)

### Verification gate — Phase1

- [ ] typecheck green
- [] phase tests green- [ ] no regression---

## Phase2 — Multi-outlet menu,availability, courses, variants (spec-spec-5)

Domenu before orderlifecycle so the ordercan resolve a realbranch/area menu.

**Alreadydone (🟡,leave core, fix gaps):** `Menu/Category/Item/ModifierGroup/Modifier` catalog; `menuAdminProcedure`gate on create;`setItemAvailability` mutation exists; `isAvailable` columnexists.

- [ ]**Scope `Menu` to `branchId`(not justtenant)** — `schema.prisma`+ `packages/api/src/routers/menu.ts` — _test:_twobranches returndifferentmenus; cross-branch fetch is empty.
- [ ]**Filter unavailable items out of `menu.list`** (currentlyonly filters `isActive`) — `menu.ts` — _test:_ itemwith`isAvailable=false` is absent from `menu.list` output(spec §6.1 rule 2).
- [] **Implement `RestaurantProfile`hub** (default menu,default area, area-wise +order-type-wise toggles, tax/invoice prefixes) —`packages/api/src/routers/restaurantProfile.ts` — _test:_profile CRUD;defaultmenu resolves.- [ ] **Implement Serving Area (Room) entity + CRUD** — `packages/api/src/routers/area.ts` — _test:_ createarea, listbybranch.
- [] **Implement Area→Menu and OrderType→Menu mapping**— `area.ts` /`restaurantProfile.ts` — _test:_ mapping rowresolves anarea to a menu.
-[ ] **Implementmenu-resolution decision tree**(area precedence → billing-role gate → fallback to default→S_ERRon no default) — `packages/api/src/services/menuResolver.ts` — _test:_ unit table: area-mapped menu wins; missing area falls back to default;nodefault throws S_ERR.
- [ ] **Implement Course entity**(unique serving-priority int perbranch, indicate-in-kitchen flag)— `packages/api/src/routers/course.ts` — _test:_ twocourses can't share a serving-priority (unique violation surfaces asCONFLICT).- [ ] **Implement Variant**(itemdeclares ≤1-select alternates, priced from ownmenu line) — `menu.ts` —_test:_ selecting avariant changes the resolved line price; selecting twovariants is rejected.- [ ] **Upgrade Modifier/Add-on to reference sellable items** (becomeindependent orderlines per§5.5;validate menu-membership) — `menu.ts` — _test:_add-on referencing a non-menu item is rejected (spec R9); valid add-on becomes itsown orderline.
- [ ]**Referential-integritycheck on menu save** (allvariant/add-on refsmust exist as menu lines, else reject) — `menu.ts` — _test:_ savewith danglingref →BAD_REQUEST.
- [ ] **Price defaulting onsave** (backfill null rate from catalog standard rate) — `menu.ts` — _test:_itemsaved with null rate inherits catalog rate.- [ ] **Implement PriceList + one-to-one menu⇄pricelist projection** (Absent/Synced/Stale;wholesale rebuildon save; purge on delete) —`packages/api/src/services/priceListProjection.ts` — _test:_ editing a menu marks itspricelist Stale thenSynced after rebuild;deleting purges.
- [ ]**Implement aggregator pricingpath** (partner-boundpricelist, disabled-item filter, itemcode/name/price/image) — `packages/api/src/routers/partner.ts` — _test:_ aggregator fetch returns onlyenabled items withpartner prices.
- [ ]**Name denormalization propagation** (catalog rename → all menu lines /pricelist lines) — `menu.ts` — _test:_rename item,assert pricelist linenameupdated.
- [ ] **Return last-modified timestamp forclient cache staleness** — `menu.ts` — _test:_`menu.list` responseincludes max`updatedAt`.
-[ ] **Branch-scopemenu RBAC via userpermissions** (not just tenant rank) — `menu.ts` — _test:_manager ofbranch A cannot edit branch B menu.### Verification gate —Phase 2

- [] typecheck green- [ ] phase tests green (resolver table, availability filter, projection statemachine, variant/add-on integrity)
- [] no regression

---

##Phase 3 —Order lifecycle &billing (spec-spec-1)

Thecore of the system. Fixes BUG-1 through BUG-9.Wire theexisting `payments`primitives.**Already done (✅, leave alone):** priced `order.create` via`priceLines` (Decimal, snapshots name/unitPrice/taxRate/lineTotal); fail-loud NOT_FOUND on unknown item(rule 10); `money.ts` paiseintegers; `moneySchema` ≤2-decimals; `payment.record` rolegate excludes WAITER;`order.cancel` blocks cancelling PAID and is OWNER/MANAGER-gated.

###Order state machine (BUG-1)

- [] **Add a forward-only transition table for`OrderStatus`**(OPEN→SENT_TO_KITCHEN→READY→SERVED→BILLED→PAID;+CANCELLED/CONSOLIDATED/RETURNED perrules) — `packages/api/src/services/orderState.ts` — _test:_ unit table: OPEN→PAID rejected, PAID→OPEN rejected, SERVED→OPEN rejected, valid forward steps pass.
- [ ]**Replace `order.setStatus` free-for-all with guarded transition** (call`canTransition`;forbid KITCHEN/WAITER reaching PAID/BILLED)— `packages/api/src/routers/order.ts:203`— _test:_ integration: KITCHEN rolesettingPAID → FORBIDDEN;illegal jump → BAD_REQUEST.
- [ ] **Addbilled-marker semantics** (document-state×billed-marker asorthogonal per§4.1;reject stale re-bill) — `order.ts` — _test:_re-billing an already-billed order →CONFLICT (rule 3,one-way).

### Bill step

- [ ]**Add `order.bill` procedure** (permission-gated byTerminalProfile roles-allowed-to-bill; print → set`billedAt` → release table) — `order.ts` — _test:_ billingsets `billedAt`, transitions to BILLED,releases table toAVAILABLE;unauthorized role→ FORBIDDEN.
- [ ]**Write `discountTotal` +`roundOff` duringbill** —`order.ts` — _test:_ bill with discount recomputes grand total; round-off recorded.

### Table occupancy invariant(BUG-2, BUG-3, BUG-4)

- [] **Set tableOCCUPIED +`occupiedAt`on `order.create`** —`order.ts:104` — _test:_ creating a dine-in order flips table to OCCUPIED (§4.2invariant).
- [] **Validate `tableId` belongs tobranch/tenant and isfree before seating** — `order.ts:107` — _test:_ foreign table id→ NOT_FOUND;already-occupied table → CONFLICT.
-[ ] **Releasetable (idempotent, cluster-aware) on bill/pay/cancel/transfer** — `order.ts` —_test:_ cancelling thelast unbilled order releases the table; asecond order on the same table keeps it occupied (rule 4).
- [ ] **Replace `table.setState` free-for-all with transition guard + rolegate** (occupancy derived from orders, not free-text;WAITER cannot forcestate) — `packages/api/src/routers/table.ts:68` — _test:_ arbitrary statewrite→ BAD_REQUEST; occupancy reflects orderpresence.
- [ ]**Enforce "occupied iff ≥1 unbilled draft order referencestable"** invariant check— `packages/api/src/services/tableOccupancy.ts`— _test:_ propertytest: aftereachop, invariant holds.
- [] **Attention/Active time-derived threshold** (recompute `attentionSince` from `occupiedAt`) — `tableOccupancy.ts`— _test:_ table olderthan threshold reports ATTENTION.### Cart edits (BUG-5prerequisite, BUG-8)

- [] **Block `addItems` onBILLED orders unless edit-after-bill toggle set** (currently guards only PAID/CANCELLED) — `order.ts:142` — _test:_ addItems to BILLED →FORBIDDEN whentoggle off (rule 9).
- [] **Add `order.reduceItem` / `order.removeLine` (quantity edit + linedelete)** — `order.ts` — _test:_reducing qty recomputes totals;removing asubmitted-to-kitchen line triggers PARTIAL cancel KOT (verified in Phase 4).- [ ] **Add order-level comment distinct from itemnotes** — `schema.prisma` + `order.ts` — _test:_ comment persistsand appears onbill.
- [] **Fix `nextOrderNumber`collision** (per-branch sequence table, not `Date.now().toString(36)`) —`order.ts:84` — _test:_concurrencytest: 50parallel creates yield50 unique sequential numbers.

### Paymentsettlement (BUG-6, BUG-7,BUG-9)

-[ ] **Wire`validateSplit` + `settleSplitPayment` into`payment.record`** (tendersmustsum to grand-total to thepaise; CASH/COMPLIMENTARY→CAPTURED, gateway→PENDING)— `packages/api/src/routers/payment.ts:13` — _test:_ splitnotsumming to grand total → BAD_REQUEST; valid split creates correct per-tender statuses.
- [] **Settlement drivesorder→PAID withrunning balance** (fullpayment transitions to PAID; partial keeps openwith balance) — `payment.ts` — _test:_ fully-paid order becomes PAID; under-payment stays withresidual balance;over-payment rejected.- [ ] **Wire `state.ts` `canTransition`into `payment.setStatus`** (onlyPENDING→CAPTURED/FAILED, CAPTURED→REFUNDED) —`payment.ts:80` — _test:_ REFUNDED→CAPTURED rejected;FAILED→CAPTURED rejected.- [ ] **Remove client-supplied CAPTURED default for gateway methods** (CARD/UPI must goPENDING thengateway-confirm;onlyINSTANT_METHODS auto-capture) — `packages/api/src/schemas/payment.ts:27` +`payment.ts` — _test:_ CARD tender recorded as PENDING,not CAPTURED.- [ ] **Convert `refund` to reversing entry + supportpartial refund** (write reversal row, honor amount,use `packages/payments/src/refund.ts`) — `payment.ts:53` — _test:_ partial refund writes reversal forthe exact amount; originalCAPTURED row preserved.
- [] **Clear provisionalpaymentlines before settle** — `payment.ts` — _test:_ provisional lines removed atsettle; finaltenders authoritative.

### Advanced table/bill ops (§5.6)

- [ ] **Table transfer** (moveorder toanother freetable; relabel; release source) — `order.ts`/`table.ts` — _test:_ transfer moves occupancy and keeps single-open-order invariant.- [ ] **Servertransfer** (reassign orderowner; permission-gated) — `order.ts` — _test:_unauthorized transfer →FORBIDDEN.
- [ ] **Table merge + bill merge** (merge-cluster concept)— `packages/api/src/services/mergeCluster.ts` + `order.ts`— _test:_ mergedtables share one bill; cluster-awarerelease on settle.
- [ ]**Bill split** (splitone order'slines into multiple bills;split-to-zero rejected) — `order.ts` — _test:_split produces balanced sub-bills; split-to-zero →BAD_REQUEST.
- [ ]**Line/whole-bill discounts** (write to `discountTotal`;permission-gated) — `order.ts` — _test:_ discount recomputestax baseand grand total correctly.

### Edgecases (§6/§7)

- [] **Two-operator occupancy contention refresh** (optimistic concurrency/ versioncheck) — `order.ts` / `tableOccupancy.ts` — _test:_ concurrent seatof same table:onewins, other gets CONFLICT.- [ ] **KOT-failure-must-not-abort-order** (ordercreatesucceeds even if KOT/print fails) — `order.ts` — _test:_inject KOT failure;order still persisted.

### Verification gate — Phase3

- [ ] typecheck green
- [] phase tests green (statemachine,occupancy invariant,split settlement, transfer/merge/split,concurrency)
- [] no regression (existingpriced-create + moneytests still pass)

---## Phase 4— KOT /KDS (spec-spec-2)Depends on Phase3 orderedits (for diff-based derivation) and Phase0dual-axis schema + stations.

**Already done (🟡):** `kot.generate` first-ticket path (PENDING items→ PREPARING, orderOPEN→SENT_TO_KITCHEN); `markPrinted` stamps `printedAt`; ESC/POS `buildKot`template (station/number/items/modifiers/notes); tenant scoping onallKOTops; coarse rolegating.

### Dual-axis lifecycle

-[ ] **Use split`kind`+ `serviceStatus` fields** (stop hard-coding `status:"NEW"`) — `packages/api/src/routers/kot.ts:41` — _test:_generated firstticket =kind NEW /serviceStatus SUBMITTED.
-[ ] **Forward-only `serviceStatus` guard** (SUBMITTED→READY→SERVED; nobackward,no arbitrary CANCELLED) — `kot.ts:91` — _test:_ SERVED→SUBMITTED rejected.
- [ ]**Servedstamping** (set`servedAt`, compute `prepDurationMins` from `prepStart`) — `kot.ts` — _test:_ marking SERVEDrecordstimestamp andpositive duration.
- [] **Verification sub-state** (`verified`/`verifiedById` seton Confirm; cancellation tickets acknowledged) — `kot.ts` — _test:_confirminga cancelticket records verifier.- [ ] **Append-only immutability** (noin-place editof submitted tickets; new tickets instead) — `kot.ts` — _test:_attempt to mutate asubmitted ticket'sitems→ FORBIDDEN.

### Diff-based generation (BUG-5)

- [] **Diff engine: current vs previously-submitted lines →positive/negative/removed deltas** — `packages/api/src/services/kotDiff.ts` — _test:_ unit:adding items→ MODIFIEDticket withonlynewlines; reducing qty →PARTIAL cancel ofthedelta; removing → PARTIAL cancel.- [ ] **`order.addItems` issuesMODIFIED KOT** — `order.ts:133` — _test:_ addItems afterfirstKOT produces a kind=MODIFIED ticket.
- [ ]**`order.reduceItem`/`removeLine` issue PARTIAL cancel KOT**— `order.ts` —_test:_ reducing qty from3→1produces PARTIAL ticketfor qty 2.
- [] **`order.cancel` issues per-station FULLY-cancelled KOTs +document-cancels activetickets (atomic)** — `order.ts:224` — _test:_ cancelling anorder with 2stations produces 2cancel tickets andmarks activetickets CANCELLED(rule 9,§4.4).
- [] **Cancellation ticket references original**(`cancelsKotId`) — `kot.ts` — _test:_ cancel ticket pointsattheticket it reverses (rule 11).
- [] **Generation swallowed /idempotent backstop** (no-pending-items mustNOT throw wheninlined into order flow) — `kot.ts:29` — _test:_ generatewith zero pending itemsis a no-op,not anerror (rule 10).### Station routing (§4.3)

- [] **Category→station resolution +fan-out (one ticket per station)** — `packages/api/src/services/stationRouter.ts` — _test:_ orderspanning 2stations produces 2 tickets partitioned by category.
-[ ] **Guard: iteminno category → warning; station unconfigured → block** —`stationRouter.ts`— _test:_ uncategorized item surfaces warning; missing station config→PRECONDITION_FAILED.
- [] **Order-type-filtered station units** (takeaway vsdine-in routing) — `stationRouter.ts` — _test:_ takeaway routesonlyto takeaway-enabled stations.

###Numbering,printing, reprint- [ ] **KOT naming series from profile + mandatory-series error + cancel prefix** (replace `Date.now().toString(36)`) — `kot.ts:11` +per-branch seq — _test:_ tickets get sequential seriesnumbers; missing series →error; cancel ticketsgetcancel prefix.- [ ] **Printer resolution cascade (station→room → profile fallback)** — `packages/print/src/resolvePrinter.ts`— _test:_ stationprinter chosen whenpresent; falls back to profile.
-[ ] **Suppress-takeaway-at-station-printer flag**— `resolvePrinter.ts` — _test:_takeaway ticket suppressed at a station printerwiththe flag on.
- [ ] **Wire printintogeneration,non-fatal**(print failure logged, order/KOT unaffected)— `kot.ts`— _test:_ injectprint failure; KOT stillcreated,`TicketError` rowwritten.
- [ ]**Ticket reprint (profile flag + Duplicate kind + printer-by-order-type)** — `kot.ts:97` — _test:_ reprint creates akind=DUPLICATE ticket onlywhen profile allows.
- [] **TicketError log model+writes** — `schema.prisma` + `kot.ts` — _test:_ failed generation/print writes an error row.

###Reconciliation safety-net (§4.6)

- [] **Every-minute idempotent reconciliation job (1–5 min window)** thatemits Duplicate tickets + error log for missed submissions — `packages/api/src/jobs/kotReconcile.ts` — _test:_ simulate a droppedticket; job re-emits exactly once within window (idempotent onre-run).

### Realtime KDS (§6)

- [] **tRPC subscription keyed per branch+stationchannel** — `packages/api/src/routers/kot.ts` (subscription) — _test:_ integration: subscribingto branch A/station1 receives a pushon submit;branch B doesnot.
- [ ]**Push-on-submit/on-status-change**— `kot.ts`— _test:_ statuschange publishes to the channel.
- [ ] **Fix `kot.list` query** (submitted/verified filter, 3-hour age-off,stationmatch, order-type filter, **newest-first**;addserved-viewparallel query) — `kot.ts:64` — _test:_listreturns newest-first, excludes >3h-old, filters by station.- [ ] **KDS board surface** (per-station liveview; card contents, colorcoding, line-item strike-through,Serve+Confirm actions)— `apps/pos-web/app/kds/` — _test:_component test: servedlinerenders struck-through; Serve action calls mutation.
- [] **Timers +audio alert + delay notification (fires once)** —`apps/pos-web/app/kds/` + `packages/api/src/jobs/kotDelay.ts`— _test:_ delayed ticket triggers exactly one notification (rule 15).

###Ordinal ordernumbering (§7)- [ ] **Per-shiftordinal + aggregator-prefixed counter + reset-daily flag + invoice-baseline** — `packages/api/src/services/orderNumbering.ts` — _test:_ordinal resets atshift/day boundary; aggregator orders get prefix.

### Verificationgate — Phase 4- [ ] typecheck green
- [] phase tests green (diff engine, fan-out routing, dual-axis transitions, subscription push, reconcile idempotency)
- [ ]no regression (existing `buildKot` template+generate first-ticket tests pass)

---

## Phase 5 — Inventory,Recipe/BOM, COGS (spec-spec-3)

Depends onPhase 3(orderfinalization posts stock movement) and Phase 2(menu items toattach recipes to).

**Already done (🟡,keep thesubstrate):** `InventoryItem` CRUD + low-stock alerts + manual `adjustStock`with `StockAdjustment` audit; `Supplier` CRUD with delete-guard;`PurchaseOrder` create/receive (inbound stock IN); `reports.inventoryValuation` (on-hand value, not COGS).

### Fixexisting bugs first- [ ] **Make `purchaseOrder.receive` atomic acrossitems** (single `$transaction`, not per-item inside `Promise.all`) — `packages/api/src/routers/purchaseOrder.ts:160` — _test:_ inject mid-loop failure; assert zero partial stock updates and order NOT flipped to RECEIVED.
- [ ] **Fix race-prone PO numbering**(per-branch sequence table,unique-retry) — `purchaseOrder.ts:74` — _test:_ concurrent PO creates yield unique numbers.
- [] **Block item-level re-receive** (guard `receivedQuantity`, not justwhole-order RECEIVED) — `purchaseOrder.ts:152` — _test:_ receiving an already-received line →CONFLICT.
-[ ] **Add rolegatingto inventory/PO/supplier routers**(currently bare `protectedProcedure`;WAITER can mutate stock) — `inventory.ts:7`, `purchaseOrder.ts:7`, `supplier.ts:7` — _test:_ WAITER creating inventory → FORBIDDEN (spec §6matrix).

### Recipe/BOM engine(R1–R7)

- [ ] **Recipe CRUD with active/default/confirmed flags**— `packages/api/src/routers/recipe.ts`— _test:_ createrecipe withcomponents; onlyone defaultperitem.
- [ ]**Effective-recipeselection gate** (three-flag:active∧default∧confirmed) — `packages/api/src/services/recipeSelect.ts` — _test:_ unittable: onlythe active+default+confirmed recipe ischosen;elsenone.
- [ ] **Recursive expansion + batch normalization** (nested recipes flattened; divide by batch size) — `packages/api/src/services/bomExpand.ts`— _test:_ unit: 2-level nested recipe expands to correct leaf-ingredient quantities;batch divisor applied.
- [ ]**Bundle expansion(combo →componentsellables)** — `bomExpand.ts`— _test:_ bundle saleexpands into eachcomponent's depletion.
-[ ] **Three-way classification (plain / recipe / bundle)**atexpansion time— `bomExpand.ts`— _test:_ classifier routes each item typecorrectly.
- [] **Buying-pricesourcing from per-branch price list +unpriced-item collection/dedup/remarks (R7)** — `packages/api/src/services/buyingPrice.ts` — _test:_ itemwith no branch price iscollected once(deduped) into anunpriced-listwith remark.- [ ] **Menu-membership invariant for modifiers/variants (R9)** — enforce atrecipe/menu save — `recipe.ts` / `menu.ts` — _test:_recipe referencing a non-menu sellable → BAD_REQUEST.- [ ] **Warehouse binding fixed per kitchen (R8)** — `schema.prisma` + `recipe.ts` —_test:_ depletion posts againstthe kitchen's bound warehouse only.

### Depletion +COGS chain (§3,R1)- [ ] **Stock-depletion lifecycle**(Draft→Pending→Depleted→Reversed) posted on order finalization — `packages/api/src/services/stockDepletion.ts`, calledfrom `order.ts`/`payment.ts`— _test:_ settling anorder depletes eachingredient byexpanded qty (§3.1); nodepletion for`affectStock=false` orders.
- [ ]**Reversal on cancel/return** (Depleted→Reversed; dropped-post-finalization out of COGS) — `stockDepletion.ts` — _test:_ cancelling asettled order reverses stock and removes it from COGS.
- [ ]**COGSLine generation fromdepletion ×buying price** — `packages/api/src/services/cogs.ts` — _test:_ COGS lineequals sum(ingredient qty × branch buying price); uncosted items produce warning note,not zero-silent.
- [ ] **COGS window withlate-night offset (R11)** (business-day cutoff, not calendar)— `cogs.ts` — _test:_ a02:00 sale falls intothe prior business day per cutoff.
- [] **Consumable materials as separate expense stream(R12)** — `packages/api/src/routers/consumable.ts`— _test:_ consumable usage recorded outsideingredient COGS.- [ ] **Availability read-through, no reservation (R14)** — cart consults `InventoryItem` atreadtime only — `order.ts` — _test:_ availability reflects currentstock;concurrent carts don't reserve.- [ ] **Quantity validations(R13)** (batch≠0, non-negative resulting stock, recipe-batch-divisor) —`bomExpand.ts` / `stockDepletion.ts` — _test:_ zero batch → BAD_REQUEST; depletion belowzero →BAD_REQUEST.

### Verification gate — Phase 5- [ ] typecheck green
- [ ]phase tests green (recursive expansion, effective-recipe gate,depletion-on-settle, reversal, COGS roll-up, unpriced collection)
-[ ] no regression (existing inventory/PO/supplier suites pass after atomicity + RBAC fixes)---

## Phase 6— Shift open& cash reconciliation (spec-spec-4)

Depends on Phase 3(settled txns topull) and Phase1 shift-gate stub (now madereal).

**Already done:** nothing (subsystem absent). `CASHIER`/`MANAGER`roles exist inthe enum; gateway `reconcile.ts` is unrelated payment recon.

### Shift open- [ ] **ShiftOpening statemachine (Open→Closed;reversible on cancel)** —`packages/api/src/services/shiftState.ts` — _test:_ unit: Open→Closed valid; cancel revertsto no-open-shift.
- [] **`shift.open` flow**(pre-fill operator, resolve areas,seed OpeningFloatLines perpayment method, submit→unlock selling) — `packages/api/src/routers/shift.ts`— _test:_ opening seeds floats andmarks shiftOpen; selling nowpermitted.
- [] **Make `requireOpenShift` guard real** andcompose it into`order.create` (day-start gate:block table selection when no activeshift) — `packages/api/src/guards/shift.ts` + `order.ts` — _test:_ order.create with no open shift → PRECONDITION_FAILED.- [ ] **Multi-cashier open-ordergate** ("MainCashier POS must be open"before sub canopen) — `shift.ts` — _test:_sub-cashier open blocked until mainis open.
- [] **Prior-day-unclosed gate with05:00 business-day cutoff** — `shift.ts` — _test:_ opening a newday blocked while prior businessday unclosed.

###Sub-cashier closing

- [ ] **Closing state machine (Draft→Queued→Submitted/Failed,Retry, Cancelled)** — `shiftState.ts` —_test:_ unit table: Submitted isterminal exceptviaCancel/Amend bymanager.
- [ ]**`subClose` flow** (seed from floats;pull settled non-consolidated txns in window; netchange; livedifference) — `packages/api/src/routers/shift.ts` — _test:_ closepulls exactly the window's PAID (non-CONSOLIDATED) txns; expected = floats + settled inflows netof change.
- [] **Per-method PaymentReconciliationLine (opening/expected/closing/difference)** — `shift.ts` — _test:_ difference = counted − expected per method.- [ ] **No-open-drafts-at-close guard** (mustsubmit/delete draft invoices first) — `shift.ts` — _test:_ closewith an open draft → PRECONDITION_FAILED.
- [] **LinkedTransactionLine audit trail** (recordsincluded sales) — `shift.ts` — _test:_each includedtxn hasan audit line; excluded consolidated txns absent.

### Day-end(main) closing

- [] **`dayEndClose` flow** (mainonly; subs-closed gate; aggregation = sub counted + main counted;"NoSub POS Closing entries found" error) — `shift.ts` — _test:_ day-end blocked untilallsubs closed; aggregation sums correctly; empty subs →specific error.
- [] **Role-separation invariant** (main→day-end only; sub→sub-closing only; manager-onlycancel;cashier create/submit no-cancel; captain read-only) — `packages/auth/src/permissions.ts`+ `shift.ts`— _test:_ sub-cashier attempting day-end → FORBIDDEN; cashier attempting cancel → FORBIDDEN.
-[ ] **Field-level protection on expected/difference (manager-only override)** — `shift.ts` — _test:_cashier editing expected →FORBIDDEN;manager allowed.
- [] **Consolidated-transaction exclusion fromwindow** (uses the`CONSOLIDATED` state addedin Phase 0) — `shift.ts` — _test:_ CONSOLIDATEDorders excluded from closing window.

### Verificationgate — Phase 6- [ ] typecheck green
- [] phase tests green (open/closestate machines, windowpull, per-method recon, day-start +prior-day gates, roleseparation)
- [] no regression (order.create stillworkswithanopen shift seeded in fixtures)---

## Phase7 — Multi-outlet wiring completionMostmodelwork landed in Phase 2/Phase 0;thisphase finishes cross-cutting branch scoping thatotherphases nowdepend on.

**Alreadydone:** area/menu mapping andresolver (Phase2); TerminalProfile + branch/roomaccess (Phase 0).

-[ ] **Enforce branch scoping on everyroutervia`branchScopedProcedure`** (order, table, kot, payment, inventory, shift, reports) — allrouters under`packages/api/src/routers/` — _test:_ integration matrix: for each router, auser withoutbranch access gets NOT_FOUND/FORBIDDEN.
- [ ] **Orderresolves menu via area/order-type atcreatetime** (uses Phase 2 resolver) — `order.ts` — _test:_dine-in order inareaA prices fromarea A's menu; takeaway uses order-type menu.
- [] **Aggregator orderbindings** (partner pricelist applied to `OrderType.AGGREGATOR` orders)— `order.ts` /`partner.ts` —_test:_ aggregator order lines priced from partner pricelist,not standard menu.- [ ] **Customer validity(rule12)** (attach/validate `Customer` onorder; replace bare `guestCount`)— `order.ts` —_test:_ invalidcustomerref → BAD_REQUEST; valid customerattaches.

### Verification gate — Phase7

- [ ] typecheck green
- [] phase tests green (branch-scopematrix, area-basedpricing, aggregatorbinding)
- [ ]no regression acrossall prior phases

---

##Phase 8 — Analytics & Daily P&L (spec-spec-6)

Last,because P&L consumes COGS (Phase 5), shiftclosings (Phase 6), and settled orders (Phase 3).**Already done (🟡, keep butfix boundary +access):** `salesSummary`, `dailySales`, `topItems`, `hourlySales`, `gstReport`, `inventoryValuation`— all read-only; correctly filter `status:'PAID'`.

### Fix existing reports

- [] **Addrole gatingto all reports procedures** (currently bare`protectedProcedure` —anyuserreads financials) — `packages/api/src/routers/reports.ts:6,74,134,200,290,342` — _test:_ WAITER calling `salesSummary` → FORBIDDEN (spec §7).- [ ] **Apply business-day boundary(extended-hours cutoff) to every report** (replace raw `createdAt`/`getHours()`) — `reports.ts` —_test:_ a02:00 sale reportsunder the prior business day in`dailySales`/`hourlySales`.- [ ] **Include `CONSOLIDATED` alongside `PAID` insettled filter** — `reports.ts` — _test:_ consolidated orders appear in revenue totals.
- [] **Dense dateseriesfor `dailySales`**(zero-fill missing dates, rule 14) — `reports.ts:175` — _test:_ rangewith a gap day returns a zero-row forthat day.
- [ ] **`hourlySales` → twelve 2-hour buckets, single date** (spec §4.3) — `reports.ts:290`— _test:_ outputhas 12 buckets aligned to business-day cutoff.

###Missing reports

- [] **Month Wise Sales** — `reports.ts` — _test:_ groups revenue by month.
- [] **DaywiseInvoices** (per-invoice rows;aggregator received=0)— `reports.ts`— _test:_ per-invoice rows; aggregator invoices show received0.
- [ ]**Average Bill Value report** — `reports.ts` — _test:_ avg = revenue / ordercount overrange.
- [ ] **Employee ItemWiseSales /Employee Sales** (scope by `Order.createdById`) — `reports.ts` — _test:_sumsattributed to correct operator.
- [] **Service WiseSales** (per day perorder type grand total) — `reports.ts` — _test:_ dine-invs takeaway vsaggregator splitperday.
- [ ]**Cancelled Invoices**(who cancelled + reason; add cancelfields to `Order`) —`schema.prisma`+ `reports.ts`— _test:_ cancelled order surfaces cancellerandreason.
- [] **Customer Data /Daywise Customer Details/ RepeatedCustomers** (uses `Customer` fromPhase 0/7) — `reports.ts` — _test:_repeat-customer reportcounts orders percustomer.

### DailyP&L subsystem (stateful core, §4.2)

- [ ] **ReportSettings per branch** (buying pricelist, electricity rate, depreciation, extended-hours cutoff, expense tables) — `packages/api/src/routers/reportSettings.ts`— _test:_ settingsCRUD;submit-guard reads them.
- [ ] **Expense config tables** (direct/indirect/monthly-fixed,percentage, employee-cost, consumables) — `reportSettings.ts`— _test:_ percentage expense computes offnet sales; zero-netsafety(no divide-by-zero).- [ ] **Employee + Attendance** (salary vs daily-wage; present/half-day; monthly amortization) — `packages/api/src/routers/employee.ts` —_test:_ monthly salary amortized perday; half-day halves daily wage.
- [] **DailyPnl state machine** (Create/Save/Submit/Cancel/Amend; immutable after submit) — `packages/api/src/services/pnlState.ts` —_test:_ editing asubmitted P&L → FORBIDDEN unlessAmend bymanager.
- [] **P&L computation cascade** (gross/net sales → COGS (Phase 5) → direct expenses → gross profit → employee cost→ indirect expenses → net profit) — `packages/api/src/services/pnl.ts` —_test:_ end-to-end fixture:knownsales + recipes + expenses produce expected net profit tothe paise.
- [ ] **Submit guards** (branch hassettings; electricity>0; units>0; attendance exists; complete employee pay config) —`pnl.ts`— _test:_ eachmissing precondition yields itsspecific error.
- [] **Preparer conveniences** (electricitypre-fill from priorday; live material amount fromcurrentCOGS) — `pnl.ts` — _test:_ newP&L pre-fills prior-day electricity.- [ ] **P&L /ReportSettings RBAC** (manager+admincreate/submit/cancel; finance roles read) —`packages/auth/src/permissions.ts`+ routers — _test:_ cashier submitting P&L → FORBIDDEN.### Verification gate —Phase 8

- [] typecheck green- [ ] phase tests green (business-day boundary, dense series, P&L cascade tothe paise, submit guards, report RBAC)
- [] no regression (existing sales/tax/itemreports pass after boundary + accesschanges)

---

##Definition of done (whole project)

- [] AllphaseVerification gates checked green,in order.
- [] `prisma migrate deploy` applies cleanly fromanempty DB tothe finalschema.
- [] All 18 previously-skipped integration tests run (Postgres wired) and pass; parity tests green.
- [ ]Every confirmed bug closed witha regression test: BUG-1(order state machine), BUG-2/3 (occupancy set+release), BUG-4(table transition guard), BUG-5 (KOT diff derivation), BUG-6(splitengine wired), BUG-7 (payment state machine wired), BUG-8(BILLED edit gate), BUG-9(gateway notauto-CAPTURED), plusPO atomicity + numbering race.
- [] Order lifecycle invariants hold underaproperty/concurrency test: billed one-way, occupancy iff≥1 unbilleddraft, settlement drives PAID, forward-only order/table/payment transitions.
- [] KOT dual-axis lifecycle, per-station fan-out, cancellation ticketing, reconciliation backstop, and realtime KDS push all verified end-to-end.
- [] Recipe→depletion→COGS chain verified: settlingan order depletes expanded ingredients andproduces COGS lines; cancelreverses.
- [] Shift gate enforced: noselling without an open shift; sub/mainclosing roleseparation and business-day cutoffs verified.
- [ ]Multi-outlet:menusresolveper branch/area/order-type; branch scoping enforced on every router.- [ ] Daily P&L computes netprofit to the paise fromrealsales + COGS + expenses + attendance,with submit guards and RBAC.
- [] No routeleftonbare `protectedProcedure` wherethe spec mandates role/branch gating (orderbilling, payment, inventory, shift, reports,P&L).
- [] Full typecheck +full testsuite green; no `TODO`/stub/placeholder in shipped code.
- [] Nourysourceconsulted orcopied; all code original(clean-room),stack remains MIT.