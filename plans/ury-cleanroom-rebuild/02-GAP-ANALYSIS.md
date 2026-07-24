Inowhavecomprehensive coverage.Producing the classification.

---

# Zerosky CoverageAnalysis vs. Extracted Behavior SpecsComparisonof the5 clean-room specs against the existing zerosky TypeScript implementation. Verdicts are persubsystem,then broken down bysub-area with concrete filereferencesand gaps.

---

## SPEC 1— POS/ Billing &Order Lifecycle→ **PARTIAL**(largestgaps; ~30% covered)

**Filesreviewed:** `packages/api/src/routers/order.ts`, `table.ts`, `payment.ts`, `packages/api/src/schemas/order.ts`, `packages/payments/src/{state,multi-tender,money}.ts`, `packages/database/prisma/schema.prisma`, `packages/auth/src/rbac.ts`| Sub-area |Verdict | Evidence /Gap|
|---|---|---|
| Order draft create+linepricing +totals | **ALREADY-BUILT** |`order.ts:88-131` (`create`), `priceLines()` `order.ts:33-82`computes per-line net/tax/total andorder subtotal/taxTotal/grandTotal. |
| Modify draft (add items,re-derive totals) | **ALREADY-BUILT** | `order.ts:133-175` (`addItems`), blocks PAID/CANCELLED. |
| Orderlist bystatus,getsingle | **ALREADY-BUILT** | `order.ts:177-201`. |
| Cancel draft (permission-gated) | **PARTIAL** | `order.ts:224-246` cancels +blocks paid. Gap: doesNOT freethe table (spec §4.2release) anddoes NOT issue a full-cancel KOT (spec §4.3).|
| Orderstatus transitions | **PARTIAL** | `setStatus`(`order.ts:203-222`) allows ANY status→any(exceptfromCANCELLED). Nostate-machine guard; spec §4.1two-dimensional model not enforced. |
| **Billedmarker (one-way)** | **MISSING** | Schema`Order` (`schema.prisma:276-306`) has `status` enum incl. `BILLED` butNO boolean `isBilled`/`billedAt` marker orthogonal to document state. No "bill" mutation exists; nostale-client"already billed" rejection (spec §4.1 guard rule, §6 rule 3).`BILLED` is just anenum value, neversetbyany procedure. |
| **Table occupancy invariant (occupy/release/attention)** | **MISSING** | `table.ts:68-81` `setState` is a raw manual state write — noauto-occupy onorder create, no conditional/cluster-aware release,no derived `Attention` (time-based).Ordercreate (`order.ts:104`) nevertouches tablestate. Spec §4.2invariant entirely absent. |
| **Payment settlement →Paid +billing-user auth** | **PARTIAL** | `payment.ts:13-38` recordsa payment row (roles OWNER/MANAGER/CASHIER —correctly excludes WAITER,matching spec §3). `settleSplitPayment` (`multi-tender.ts:86`) validates split-tender.Gaps: recording a payment does NOTmove order→PAID; no "clearprovisional lines"; no profile-configurable "roles allowed to bill" toggle (hardcoded roles). |
| **Tablemerge / bill merge / bill split**| **MISSING** |No procedures, no schema (no merge-cluster/parent-tablefieldon`Table`).Spec §5.6entirely absent. || **Table transfer /server transfer** | **MISSING** | Notransfer procedure;no repointing of KOTs; nointra-branch/intra-room constraint. Spec §5.6,§6rule 13absent. |
| **Shift gate (ShiftOpening precondition)** | **MISSING** | No shift model inschema, no procedure. Order createhasNO open-shift check. Spec §5.1, §6rule 1 absent. |
|Discounts | **PARTIAL** |Schema `Order.discountTotal` exists (`schema.prisma:287`) but noprocedure applies it; no profile toggle. |
|Occupancy contention (twooperators) | **MISSING** | Nooptimistic-lock/refresh-prompt logic (spec §6 rule 6, §7).|
| Consolidate/ Return documentstates | **MISSING**| `OrderStatus` enum hasno CONSOLIDATED/RETURN; spec §4.1 statesabsent. |
| Aggregator customer/pricelist/paymodebinding | **MISSING** | `OrderType.AGGREGATOR` exists butno branch-specific binding resolution (spec §6rule 11). |

**Net:**Core cart/pricing issolid.The entire *coordination layer* (billed marker,table occupancy statemachine, shift gate,merge/split/transfer, settlement→Paid transition) is missing.---

## SPEC2 —Kitchen Display &Order-Routing (KOT/KDS) → **PARTIAL** (~20% covered)**Files reviewed:** `packages/api/src/routers/kot.ts`, `packages/api/src/schemas/kot.ts`, `packages/print/src/{index,discovery}.ts`, `packages/print/src/templates/kot.ts`, `schema.prisma` (`Kot`, `OrderItem`)| Sub-area |Verdict | Evidence / Gap |
|---|---|---|
|KOT entity withkind +status | **PARTIAL** | `Kot`model (`schema.prisma:335-352`) has`status KotStatus` enum (`NEW/MODIFIED/PARTIAL/READY/SERVED/CANCELLED`) —butthiscollapses spec's TWO orthogonal axes (kind vs.service-status) intoONE field. No`verified`/`verifiedBy`, no `servedAt`/`prepStartTime`/production-duration, no `orderNumber`ordinal, no cancel-ticket back-reference to originals. |
| GenerateKOT from pending items |**PARTIAL**| `kot.ts:16-62` createsONE kot from all `PENDING` unattached items, sets items→PREPARING, order→SENT_TO_KITCHEN. Gap:nodiff ofcurrent-vs-previous (spec§4.1);alwayseffectively "New"; noModified/Partial-cancel derivation. |
| **Station routing (multi-kitchen, item-category →station)** | **MISSING** | `Kot.station` is a free-text `String?` passed inbycaller (`kot.ts:41`). NoProductionUnit entity, no item-category→station binding, no partitioning of itemsacrossstations (spec §4.3).One order=one KOT, notone-per-station. || List KOTs, setstatus, mark printed | **ALREADY-BUILT** | `kot.ts:64-113`. |
| **Serve transition (stamp servedTime + duration)** | **MISSING** | `setStatus` just writes status; no served-time stamp, no duration compute (spec §3.2,§6rule 7). || **Verification (confirm cancellation)** | **MISSING** | No `verified` fieldorverify mutation (spec §3.3). |
| **Real-time display(perbranch+station channel,push)** | **MISSING** | No websocket/SSE/subscription. `offline`package exists but isclientsync, not KDS push.Spec §6.1 absent. |
|**Active-displayquery(Ready+submitted+unverified+3h window+order-type filter)** |**MISSING** | Nosuchquery; `kot.ts:list` filters onlyby branch/order/status. Spec§6.1,§8 invariant absent. |
| **Reconciliation safety-net job (scheduled, Duplicate tickets,error log)** | **MISSING** | No scheduled job, no `Duplicate` kind, no TicketErrorLog (spec §4.6). |
| **Full-order cancellation → Cancelledticket + doc-cancel actives** | **MISSING** | Order cancel (`order.ts:224`) issues no KOT atall (spec §4.4). |
| **Table-change repoint of activeKOTs** | **MISSING** | No transfer logic (spec §4.5). || Course/serving-priority resolution onlines | **MISSING** | NoCourse entity;`OrderItem` has nocourse/priority fields (spec §4.2). |
| Printonsubmit (station→room→profile cascade) | **PARTIAL** | `print` packagerenders KOT toESC/POS (`renderKot`,`templates/kot.ts`) and discovers USB/network printers (`discovery.ts`).Gap: no signed-bridge /CUPS / websocket transport cascade (spec §5,§8);no scope-based printer resolution; no per-room/per-station printer bindings. |
| KDS color coding,per-item strike, timers,delay notifications | **MISSING** | No KDSUI component; nonotification-recipient roles (spec§6.3-6.6). |
|Ordinal per-shift ordernumbering | **MISSING** | `nextOrderNumber()` (`order.ts:84`) is a timestamp-base36 string, not a per-shift ordinal withaggregator prefix (spec §7).|

**Net:** Asingle-stationKOT record+ESC/POS printing exists. The routing engine, dual-axis lifecycle, real-timeKDS, reconciliationjob, and coursemodelare missing.

---

## SPEC 3 — Inventory /Recipe / BOM /COGS → **PARTIAL** (~25% covered;raw-stock only)

**Files reviewed:** `packages/api/src/routers/inventory.ts`, `supplier.ts`, `purchaseOrder.ts`, `reports.ts` (`inventoryValuation`),`schema.prisma`(`InventoryItem`, `StockAdjustment`,`PurchaseOrder*`)

| Sub-area | Verdict |Evidence / Gap ||---|---|---|| Rawingredient inventory (CRUD, stock,unit cost) | **ALREADY-BUILT** |`inventory.ts:5-106`, `InventoryItem` model (`schema.prisma:382-411`)with currentStock/min/max/reorder/unitCost/supplier. |
|Manual stock adjustment(IN/OUT/ADJUSTMENT/WASTAGE) +history+negative guard | **ALREADY-BUILT** | `inventory.ts:108-164` (transactional),`StockAdjustment` model,`stockHistory` `inventory.ts:181`. |
| Low-stock alerts | **ALREADY-BUILT** | `inventory.ts:166-178`, `lowStockAlerts`. |
|Purchase orders / suppliers | **ALREADY-BUILT**| `purchaseOrder.ts`, `supplier.ts`, `Supplier`/`PurchaseOrder`/`PurchaseOrderItem` models. || Inventory valuation (stock × unitCost) | **ALREADY-BUILT** |`reports.ts:342-381` `inventoryValuation`. |
| **Recipe / BOM (dish→ingredients, nesting, effective-recipe gate)** | **MISSING** | No Recipemodel, no BOM.Items(`Item`, `schema.prisma:193`) are soldas-is;no linkfrommenuItem to InventoryItem. Spec §2,R1-R3absent. |
| **Automaticingredient depletion on sale** | **MISSING** |Order create/pay never decrements `InventoryItem`.No "affect stock" flag onOrder;no recipe expansion. Spec §3.1,R1absent. |
| **Product bundles/ combos** | **MISSING** | No bundle model/flag (spec §2,R4). `ModifierGroup`/`Modifier` exist (`schema.prisma:216-248`) but are priced add-ons, not stock-expanding bundles. || **Modifiers/variants resolving to catalog items w/ stock impact** | **PARTIAL** | `Modifier`has price only; notlinked to astocked catalog item;no menu-membership validation (spec R9). Variants absent entirely. |
|**COGS computation (3-bucket classify, recursive recipe, bundle, unpriced collection)** | **MISSING** | No COGS routine anywhere. `reports.ts` computes revenue, nevercost-of-goods-sold. Spec §4,R5-R7 absent. || **Daily P&Ldocument** | **MISSING**| SeeSpec 5. |
| **Production-unit → warehousebinding** | **MISSING** | No ProductionUnit;no warehouse concept; depletion locationundefined (spec R8). |
| Buyingprice list |**MISSING** |Cost is asingle `unitCost` on InventoryItem; no per-branch buying price list (spec R6). |
| Consumablematerials (separate expense stream) | **MISSING** |Spec R12absent. |

**Net:** Acompetent raw-materials stock moduleexists (adjustments, POs, valuation),but the entire *recipe→depletion→COGS* chain — the spec's core value—is absent.

---

##SPEC 4 —Shift Close & Cash Reconciliation →**MISSING** (~0%covered)

**Files reviewed:** entire `schema.prisma`, allrouters, `packages/payments/src/reconcile.ts`| Sub-area |Verdict | Evidence/ Gap |
|---|---|---|
|ShiftOpening record(floats, statusOpen/Closed)| **MISSING** |No shift model inschema. `grep`for `shift/closing/reconcil` matchedonly payment-gateway reconcile (`payments/src/reconcile.ts`= webhook↔txn matching, unrelated).|
| Opening floatlines perpayment method | **MISSING** | —|
| Sub-cashier closing + payment-reconciliation lines (expected/counted/difference) | **MISSING** | — || Day-end (main) closing +aggregation | **MISSING** | — |
|Multi-cashier open-order /close-order invariants | **MISSING** | — |
| Day-boundary / prior-day-close enforcement | **MISSING** | — |
|Closing background-processing statemachine (Queued/Failed/Retry) |**MISSING** | —|
| Field-level protection of expected/difference |**MISSING** | —|

**Net:** Thissubsystem doesnot exist in zeroskyat all. `packages/payments/src/reconcile.ts` isgateway payment reconciliation (matchingRazorpay webhooks to payment rows), NOT cash-drawer shift reconciliation —do not confuse thetwo.Must bebuilt from scratch:newPrisma models (ShiftOpening, OpeningFloatLine, SubPosClosing, DayEndClosing, reconciliation/linked-txn children), a router, and thestate machine.

---

## SPEC 5 — Analytics & Reports (Daily P&L+ ItemTrends) → **PARTIAL** (~30% covered; sales reports only)

**Files reviewed:** `packages/api/src/routers/reports.ts`, `partner.ts`(performance), `apps/pos-web/app/reports/page.tsx`| Sub-area |Verdict | Evidence / Gap |
|---|---|---|
|Sales summary (revenue, orders, avg,payment/order-type breakdown) |**ALREADY-BUILT** | `reports.ts:6-71` `salesSummary`— filters `status: 'PAID'`. |
| Item-wise sales / top items (item trends) | **ALREADY-BUILT** | `reports.ts:74-131` `topItems` (groupBy itemId, sum qty/revenue).Covers spec's"Item Wise Sales". |
| Dailysales (per-day rollup) | **PARTIAL** | `reports.ts:134-197` `dailySales` —groups by date.Gap: NOT adense dateseries (spec §4.3"everydayappears evenwithzero"); only dayswith sales appear. || Hourly sales |**PARTIAL**| `reports.ts:290-339` `hourlySales`— 24 one-hour buckets.Spec §4.3"Time Wise"wants 12 two-hour buckets;close butnot matching. |
| GST report(tax breakdown) | **ALREADY-BUILT** (adjacent)| `reports.ts:200-287` — notin spec butuseful;spec's"taxes" columns partially covered. |
|Inventory valuation | **ALREADY-BUILT** | `reports.ts:342-381`. || Partner/revenue-share performance | **ALREADY-BUILT**(adjacent) | `partner.ts:181-248`. |
| **Onlysettled (paid/consolidated) counted** | **PARTIAL** |Reports filter `status:'PAID'` (correct-ish) but thereis no `CONSOLIDATED` status;spec §5rule 1 half-met. |
| **Business-day boundary (extended-hours cutoff)**| **MISSING** |All reports use plain `createdAt` calendar-date windows (`reports.ts:16,144,208`). No ReportSettings,no configurable cutoff (spec §4.1,Rforlate-night). Fatal for reconcilingwithP&L. |
| **Daily P&L statement (COGS,expenses, gross/net profit, %s)** | **MISSING**| No P&L router/model. NoCOGS (depends on missing Spec 3recipe layer). No expense tables, electricity,depreciation, employee cost, attendance. Spec §3.1, §4.2 entirely absent. |
|**P&L documentlifecycle (Draft→Submitted→Cancelled→Amended)** | **MISSING** | —|
| **ReportSettings (buying price list, expenses,day-boundary)** | **MISSING** | — || Cancelled-invoices /customer-data / repeat-customerreports | **MISSING** |Spec §4.3 lists 14reports;~5exist.Cancelled invoices, customer PII reports, service-wise, month-wise, average-bill,employee-sales, repeat-customersabsent. |
| Employee cost / attendance integration | **MISSING**| No Employee/Attendance models. |
|Role/PII gating (manager/finance only) | **PARTIAL** |Reports are `protectedProcedure` (any authenticated user) — NOT restricted to manager/finance(spec §7).PII (customer mobile) reports don't exist yet but gating is alreadytooloose. |

**Net:** Read-only sales/item-trend reporting isdecent.The finalized financial statement (Daily P&LwithCOGS +fullexpense model) —the spec's centerpiece — is entirely missing, and blocked onSpec 3's recipe/COGS layer.

---## Cross-cutting gaps affecting multiple specs

1. **NoShift model** — blocks Spec 1(§5.1 gate), Spec 2(§7 ordinal numbering), Spec 4(entirely), Spec5 (P&L periodanchoring).
2. **No Recipe/BOM/warehouse layer** — blocks Spec 3 (depletion +COGS) and Spec5 (P&L COGS).
3. **Noreal-time transport (websocket/SSE)**— blocks Spec2 KDS push. `packages/offline`isclient-side SQLite sync, not serverpush.
4. **No orthogonal statemarkers** — `OrderStatus` and `KotStatus` are singleflatenums (`schema.prisma:43-68`); bothspecs require twoorthogonal dimensions (doc-state ×billed-marker;ticket-kind × service-status ×verified). Requires schema migration,not justcode.
5. **Permission modelis coarse** — `rbac.ts` isa5-role rankladder +`roleProcedure` allow-lists. Noper-terminal-profile toggles("roles allowed to bill", "view-all-statuses", "edit-after-bill",transfer permissions), no branch/roomrecord-scoping.Everyspec's§permissionsection needs this.
6. **NoProductionUnit / KitchenStation / Course/ Menu-resolution (area/order-type) entities** — themulti-outlet menu-resolution spec (referenced inSpec-set)is essentially unbuilt: `Menu` (`schema.prisma:161`) has `isDefault`/`isActive` but no area→menu or order-type→menumaps, no price-list projection, no RestaurantProfile.## Summary table| Spec | Verdict | Rough coverage |
|---|---|---|
|1 —Billing & Order Lifecycle | PARTIAL | ~30% (cart/pricing done; coordination layer missing) |
|2 — KOT /KDS | PARTIAL | ~20% (single-station KOT + ESC/POS;norouting/KDS/reconcile) |
| 3— Inventory / Recipe / COGS | PARTIAL | ~25% (raw stock done; recipe/depletion/COGSmissing) |
| 4— Shift Close &Cash Reconciliation | MISSING |~0% |
| 5— Analytics / P&L | PARTIAL | ~30% (sales reports done; P&L/COGS/day-boundary missing) |**Buildpriority (dependency-ordered):** Shift model → Tableoccupancy +billed-marker (schema migration) → Recipe/BOM/warehouse → Stationrouting + KDS real-time → COGS →Daily P&L →Shift-close reconciliation.Specs 4and theP&L halfof 5 are pure greenfield;Specs 1–3 are schema-migration-heavy extensions ofexisting partialcode.