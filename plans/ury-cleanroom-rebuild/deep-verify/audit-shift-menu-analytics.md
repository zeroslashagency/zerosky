The grep confirmsthe keyfinding: noShift/POS-closing model, no RestaurantProfile/ServingArea/PriceList/Course/Variant/AddOn/ReportSettings/DailyPnlanywhere inschema or routers. The only "reconcile" isgateway-payment reconciliation (adifferent concept). I have everythingneeded.Deep-verification complete.Three itemized checklists follow.---

## SPEC4 — SHIFT CLOSE & CASHRECONCILIATIONVerdict: essentially **entirely unimplemented**. The core`Shift`/opening/closing domain does not exist.No `shift.ts` router, no `Shift`,`ShiftOpening`, `SubPosClosing`, or`DayEndClosing` model in`packages/database/prisma/schema.prisma` (whole fileread,models endat `BranchPartner`line 552). The only "reconcile" in the repo (`packages/payments/src/reconcile.ts`) is gateway-vs-local **payment** reconciliation— unrelated to cash-drawer/shift close.

-❌ **Shift Opening Record** model (operator, outlet, area, opentime, statusOpen/Closed, closing ref) — nosuchmodel;`schema.prisma` hasno shift entity (searched all 552lines +grep acrosspackages,0 hits).- ❌ **Opening FloatLine** (per-payment-method starting cash) — absent.
-❌ **Sub-Cashier Closing Record**(period, linked-txns, payment-recon list, status) — absent.
- ❌ **Linked-TransactionLine** (audit trail of includedsales) — absent.
-❌ **Payment-ReconciliationLine** (opening / expected/ closing/ difference permethod) — absent.
-❌ **Day-End Closing Record (Main Closing)** —absent.
- ❌**Outlet Profile** flags (multiCashier,dailyClose enforcement, main/sub cashier designation, accepted payment methods) —`Branch` model(`schema.prisma:110-133`) has noneof these.
- ❌**Shift Openingstatemachine** (Open→Closed,reversible oncancel) — no code.
- ❌ **Closing statemachine** (Draft→Queued→Submitted/Failed,Retry, Cancelled) — no code.
-❌ **ShiftOpen flow** (pre-fill operator, resolve areas, seed floats, submit→unlock selling) — no code.
-❌ **Multi-cashier open-order gate**("Main Cashier POS must be open") — no code.
- ❌ **Day-start gate** (block table selection whenno activeshift) — `order.ts` routerexists but doesnot reference any shift; nothing blocks onshift state.
- ❌ **Prior-day-unclosed gate** with05:00 business-day cutoff — no code.- ❌ **Sub-cashier close flow** (seed fromfloats, pull settled non-consolidated txns inwindow, net change, livedifference) — no code.
-❌ **Expected= floats + settled inflows netof change** — no code.- ❌ **Difference = counted − expected** per method —no code.
- ❌**No-open-drafts-at-close guard** ("Submit/Delete Draft Invoices") — no code.- ❌ **Day-end close flow** (mainonly,subs-closed gate, aggregation=sub counted + main counted, "NoSub POS Closing entries found")— no code.
-❌ **Role-separation invariant** (main onlyday-end;sub only sub-closing) — no code.
-❌ **Consolidated-transaction exclusion**from window — no`CONSOLIDATED` stateexists;`OrderStatus`(`schema.prisma:43-51`) hasonly OPEN…PAID/CANCELLED.- ❌ **Field-level protection** onexpected/difference (manager-only)— N/A,fields don't exist.
-❌ **RBAC forshift/closing** (manager cancel;cashier create/submit no-cancel; captain read-only) — `rbac.ts` is a generic rank/exact-role helper (lines 1-50) with no shift permissions;no per-doctype permission matrix.
-🟡 **Cashier roleexists** — `UserRole`enum has`CASHIER`/`MANAGER`/`OWNER`/`WAITER`/`KITCHEN` (`schema.prisma:20-26`), sothe rolevocabulary ispresent,but "main vs sub cashier" distinction isnotmodeled.

Net:0implemented, ~24❌. The task's hypothesis iscorrect — the Shift modeldoes not exist atall.

---

## SPEC 5 — MULTI-OUTLET MENU / PRICING/ AVAILABILITY

Verdict: **partial**. A basic single-menu-per-tenant catalog exists (`menu.ts`,`Menu/Category/Item/ModifierGroup/Modifier`), but the entire multi-outlet resolution engine, price-list projection, courses, variants/add-ons, and aggregator pricing are missing.

-❌ **Branch-scoped menus**— `Menu` is scoped to `tenantId` only,not `branchId` (`schema.prisma:161-175`; `menu.list` filters by`ctx.auth.tenant.id`, `menu.ts:11`). Menus cannot vary peroutlet.
- ❌**RestaurantProfile** (per-branch hub: default menu, defaultarea, area-wise/order-type-wise toggles, mapping tables, tax/invoice prefixes)— no such model.
-❌ **Serving Area (Room)** entity — absent (`Table.section` is a free-text string,`schema.prisma:259`, not an area entity).
- ❌**Area→Menu /OrderType→Menu mapping tables** — absent.
- ❌ **Menu Resolution decision tree** (area precedence, billing-role gate, graceful fallback to default,S_ERR onno default)— no resolver code anywhere; `menu.list` justreturns all activemenus for the tenant (`menu.ts:9-24`).
- ❌**Billing-role gate** for order-type resolution— noconcept ofbilling-permitted-rolelist.- 🟡 **Menu Line =catalog item + rate**— partially:`Item` carries `price`/`taxRate` directly ontheitem (`schema.prisma:198-199`) rather than a menu-line overlay;same item cannot appear onmultiple menus at different rates. The "menu line" abstractionis collapsed into theitem.
-❌ **`special`/featured flag** on menu line — absent from`Item`.
-🟡 **`disabled`/availability flag** —`Item.isAvailable` exists (`schema.prisma:203`) and `setItemAvailability` mutation exists (`menu.ts:63-73`), but `menu.list` does **not** filter outunavailable items (only`isActive`on category/menu isfiltered, `menu.ts:16-18`), so disabled items are stillreturned — violates §6.1rule 2.
-❌ **Course** entity (unique serving-priority int, indicate-in-kitchen flag) — absent. "Main Course" in`seed.ts:74` is justa `Category` name, notaCourse entity.
- ❌**Course serving-priorityuniqueness** invariant — N/A,noCourse.
- ❌**Variant** (catalog item declares ≤1-selectalternates,priced from ownmenu line) — absent.`ModifierGroup`/`Modifier` (`schema.prisma:216-248`) isa superficially similar butdistinct concept (modifiers areinline priced add-ons, not referencesto other sellable catalog items).- 🟡 **Add-on** —`ModifierGroup` with `minSelect`/`maxSelect`/`isRequired` (`schema.prisma:220-222`) loosely covers inclusiveadd-on selection, but modifiers arestandalone name+price rows,not referencesto catalog items, and don't become independent order lines perspec §5.5.Ordersnapshot stores `modifiersJson` (`schema.prisma:319`).- ❌ **Variant/add-on referentialintegrity** (all refs must exist as menu lines,save rejectedotherwise) — novalidation;`createItem` (`menu.ts:32-51`) doesno such check.
-❌ **Price defaulting onsave** (backfill null rate from catalog standard rate) — nomenu-save projection logic; `createItem` requires `price` inschema.
- ❌**Price List**model+one-to-onemenu⇄pricelist —absent entirely.
- ❌**Price-list projection statemachine** (Absent/Synced/Stale, wholesale rebuild on save, purge ondelete) — no code.- ❌ **Aggregator pricing path** (partner-bound pricelist, disabled-itemfilter, itemcode/name/price/image) — absent. `OrderType.AGGREGATOR` enum valueexists (`schema.prisma:40`) but no pricing path reads apartner price list.
-❌ **Name denormalization propagation** (catalog rename → allmenu lines) — N/A (no separate menu-line name;`OrderItem.name` is anorder-time snapshot only, `schema.prisma:313`).
-❌ **Last-modifiedtimestamp forclient cache staleness** returned bymenu fetch — `menu.list` returns rows (whichhave`updatedAt`)but there's no resolution/caching contract.
- 🟡**RBAC —manager/owner full menu CRUD** —`menuAdminProcedure = roleProcedure("OWNER","MANAGER")` guards `createMenu`/`createItem` (`menu.ts:6,26,32`). Reasonable, butcoarse (rank-based, no branch scoping).- 🟡 **RBAC — availability writeby cashier/waiter** — `setItemAvailability` allows OWNER/MANAGER/CASHIER/WAITER (`menu.ts:63`), roughly matching "cashierconstrained write,"but there'sno captain-read-only vs cashier distinction andno branch scoping.
-❌ **Branch scoping viauser permissions** — all menu queries scope by tenant only,neverbybranch/user-permitted-branches.Net: ~3🟡 (partial modifiers/availability/RBAC), rest ❌. Only aflat single-tiertenant menu exists;the multi-outlet layer is absent.

---## SPEC 6— ANALYTICS& REPORTS (DAILY P&L)Verdict: **reports partially present;P&L entirely absent**. `reports.ts` implements severalread-only sales/tax reports, but noneapply the business-day boundary, and the entire Daily P&L finalized-statement subsystem (thestateful halfof the spec) does not exist.Reports side(§4.3):-🟡 **Today'sSales / sales summary** — `salesSummary` (`reports.ts:6-71`) gives revenue,ordercount, avg,payment &order-type breakdown.Close to"Today's Sales" butisrange-based andlacks round-off/cash-discount columns; no business-day boundary.
- 🟡**DaywiseSales** — `dailySales` (`reports.ts:134-197`) groups by date withrevenue/orders/tax/discount,but **notadense dateseries** (spec §5rule 14 /§4.3):only dates with orders appear (`dailyData` keyed offactual orders, `reports.ts:175-192`).❌ ondense-series requirement.
-🟡 **Item WiseSales (item trends)** — `topItems` (`reports.ts:74-131`) groups `orderItem` by itemwithqty/revenue,joins category.Covers the core trend butordered by qty desc with a`limit` rather than grouped-by-categoryorderingperspec.- 🟡 **Time Wise Sales** — `hourlySales` (`reports.ts:290-339`) buckets into 24 hourly slots (spec asks for twelve 2-hour buckets,single date).Functionally adjacent; uses local`getHours()` withno business-day cutoff.
-🟡 **GST/tax report** — `gstReport` (`reports.ts:200-287`) doesCGST/SGST split byrate. Not in thespec's report catalogperse (spec isP&L-centric)but alegitimate tax report;assumes intra-state,noIGST logic (`reports.ts:253-258`).
- 🟡**Inventory valuation** — `inventoryValuation` (`reports.ts:342-381`) —extra report, not in spec.
-❌ **MonthWise Sales**— notimplemented.
-❌ **Daywise Invoices** (per-invoice rows, aggregator received=0) — not implemented.- ❌ **Average Bill Value** report— not implemented (avgis onlyinside `salesSummary`).
- ❌**Employee Item Wise Sales / EmployeeSales**— not implemented (no operator scoping;`Order.createdById` exists but no reportuses it).
- ❌**Service WiseSales** (per dayper order type grand total) — not implemented.
- ❌ **Cancelled Invoices** report(who cancelled, reason) — not implemented;schema has no cancel-reason/cancelled-by fields on`Order`.
-❌ **CustomerData / Daywise Customer Details / RepeatedCustomers** — notimplemented; **noCustomer entity exists** inschema atall (`Order`has no customer relation,`schema.prisma:276-306`).
- ❌**Business-day boundary** (extended-hours cutoff,shared rule §4.1) — **notapplied anywhere**;every report uses raw `createdAt` with`newDate(startDate)`/`.getHours()` (e.g. `reports.ts:16-19, 297-300, 331`). Figures will not reconcile witha P&L perspec §4.1.- 🟡 **Settled-only filter** — reports correctly filter `status:'PAID'` (`reports.ts:20, 86, 148,217, 308`), but specrequires "PAID **or CONSOLIDATED**" — no`CONSOLIDATED` state exists, sopartial.Daily P&L side (§4.2,thestateful core):
-❌ **Daily P&L Statement**model (perbranch/date, draft→submitted→cancelled→amended, summary +breakuptables) — absent entirely.
- ❌**P&L statemachine** (Create/Save/Submit/Cancel/Amend, immutabilityafter submit) — nocode.
- ❌**Report Settings** perbranch (buying pricelist, electricity rate,depreciation, extended-hours cutoff, expense tables) — absent.
-❌ **Expense configtables** (direct/indirect/monthly fixed,percentage, employee-cost, consumables) — absent.
-❌ **COGS computation** (plain / recipe-recursive / bundle expansion,buying-price resolution,warningnotes foruncosted) — absent.NoRecipe/BOM,Bundle, or BuyingPrice entities.
- ❌ **Gross/net sales derivation** (grand total,tax, discounts+round-offs, net) — notcomputed asa P&L;`Order` has no round-off field.
- ❌ **Direct expenses /Gross profit / Employeecost /Indirect expenses /Net profit** cascade (§4.2steps 3-7) —absent.
- ❌**Employee/Attendance** entities (salary vs daily-wage, present/half-day, monthly amortization) — absent.
-❌ **Percentagesofnet sales** withzero-netsafety — absent.
-❌ **Submit guards** (branch must have settings; electricity>0; units>0; attendance exists; complete employee pay config) — absent.- ❌ **Preparer conveniences** (electricitypre-fill from prior day, livematerial amount) — absent.
-❌ **P&L /Report Settings RBAC** (manager+admin create/submit/cancel; financeroles readreports) — `rbac.ts` hasno P&L permissions, and **`reports.ts` uses plain `protectedProcedure`** (`reports.ts:6,74, 134, 200, 290,342`) — **anyauthenticated user can read allfinancial reports**, violating spec §7(shouldbe gated to manager/finance).No branch scoping /PII gating (moot:no customer PII stored).Net:~6🟡 (basic sales/tax/item/hourly reports exist butboundary-blind and access-ungated), rest ❌. The entirefinalized-P&L subsystem and all customer/employee/cancellation reporting are absent.

---### Cross-cutting notes
- **RBAC (`rbac.ts`)**is ageneric5-tier rank helper(KITCHEN=1 … OWNER=5) with `hasMinRole`/`hasExactRole`(lines 6-49). It haszero per-feature permission matricesfor shift/P&L/report-settings,and thereis **no branch-level recordscoping** anywhere—everyrouterscopes by`tenantId` only.- **Reports router is unguarded byrole** —amaterialfinding:`reports.ts` procedures are `protectedProcedure`, sofinancial P&L-adjacent data isreadable by cashiers/waiters/kitchen, contrary toSpec 6§7.
- **Schema gaps thatblockall three specs**: no `Customer`, no `Shift`/closing family, no `RestaurantProfile`/`ServingArea`/`PriceList`/`Course`/`Recipe`/`Bundle`/`BuyingPrice`,no `ReportSettings`/`DailyPnl`,no `Employee`/`Attendance`, no`CONSOLIDATED` order state, no round-off fieldon `Order`.

Relevant files:`/Users/xoxo/Documents/resreah/billing/zerosky-repo/packages/api/src/routers/reports.ts`, `/Users/xoxo/Documents/resreah/billing/zerosky-repo/packages/api/src/routers/menu.ts`, `/Users/xoxo/Documents/resreah/billing/zerosky-repo/packages/api/src/routers/partner.ts`, `/Users/xoxo/Documents/resreah/billing/zerosky-repo/packages/auth/src/rbac.ts`, `/Users/xoxo/Documents/resreah/billing/zerosky-repo/packages/database/prisma/schema.prisma`.