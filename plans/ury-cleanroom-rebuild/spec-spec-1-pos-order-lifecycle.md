Ihavecompletecoverage ofthe orderlifecycle,billing, payment, KOT, tablestate, and permissionmodel. Writing the neutral clean-roomspecification now.

---# FunctionalSpecification: POS /Billing & OrderLifecycle Subsystem

## 1.Purpose

This subsystem manages the fulllifecycle of a restaurant order from creation throughkitchen production, billing, payment settlement, and end-of-day reconciliation. It coordinates threeconcerns that muststay consistent withone another atall times:

1. **The order record** — the evolving list of items, quantities, customer, and totals forone dining partyor checkout.
2. **Thephysical resource state** — whether a table is freeor inuse, and bywhom.
3. **Thekitchen workqueue** — thetickets that tell the kitchen whatto make, remake, orvoid.

The designgoal is thata single order flows through order-taking,kitchen fulfillment, billing,and payment withouteverleaving atable, aninvoice, or a kitchen ticket in acontradictory state. It supports multiple service modes (dine-in, takeaway/quick-service, delivery,and third-party aggregatororders), multiple concurrent cashiers underone terminal profile, and multi-outlet hierarchies.

---## 2. Domain Entities andRelationships (conceptsonly)

-**Outlet hierarchy**: Acompany owns one or more **Branches**.Abranch contains one or more **Restaurants/Dining areas**,each divided into **Rooms**, each holding **Tables**.Every operationalrecord(order,ticket, shift) is scoped to a branch.- **Table**: A seatable resource witha physical location (room), ashape/sizefor visual layout, aseat count, and alive occupancy state.Atable may be individually occupied orjoined withsibling tables into a **merge cluster**serving oneshared order.
- **Order/Invoice**: The centraltransactional record. It begins lifeas a draft andcarries:ordertype, theowning table (fordine-in)or none(for takeaway), customer, partysize, lineitems,comments, runningtotal, theassigned server,the operating terminal profile, and the settling cashier. It alsotracks twoindependent lifecycle markers describedin §4:a documentlifecycle state anda **billed marker**.- **OrderLineItem**: Oneitemonanorder — itemreference, quantity, unitprice, and an optional per-line comment.
- **OrderType**: Aconfigurable servicemode (dine-in, takeaway, delivery, aggregator, or othersdefined perdeployment). Aggregatortypesbind a dedicated customer, price list, and payment mode perbranch.
- **Kitchen Ticket (KOT)**: A kitchen workorder derived from an order. Eachticket hasa type(new/ modified / partially-cancelled / fully-cancelled / duplicate)and a production status(queued →preparing → served). Tickets reference theiroriginating order,the table,theroom, and atarget kitchen unit.
- **Kitchen/Production Unit**: A logical kitchen stationwith its own display queue, itsownitem-group scope, itsown printers, and optional order-type filtering. Itemsonan order route to the unit that owns their itemgroup.
- **Menu /Menu Item /Menu Course**: Amenu is bound to a pricelist and may vary by room and byorder type. Items belong to courses (e.g., starters, mains) that carry a serve-priority usedto sequence kitchen preparation.
- **Shift records**: A **ShiftOpening** (per cashier, per day) gates all activity; **Sub-Shift Closings** leteach sub-cashier reconcile their own takings; a **MainShift Closing** closes the day.
- **Terminal Profile**:The configuration bundle for a pointof sale — enabled discounts, list-lengthlimits, role permissions, printer transport, kitchen alert timings, and behavioral toggles.Relationships inbrief:Branch → Room→ Table (containment); Order → manyLine Items (composition); Order → manyKitchen Tickets overits life (one-to-many,append-only); Order↔ Table (adraft dine-in order occupies exactly one table oronemerge cluster); Menu →Price List (binding); ItemGroup → ProductionUnit (routing).

---

## 3. Actors and Permission Requirements

Three operational roles,plus record-scoping andprofile-leveltoggles.**Roles**- **Manager** — fulloperationalcontrol acrossall functions.- **Cashier** — create/edit orders, manage tables, generate bills, and takepayment.
- **Captain/Server** — create/edit orders and provide table service,but **cannot** take payment or settle bills.

**Record scoping**- Each useris scoped to specific terminal profiles,branches, and rooms.A user may only acton tables and orders withintheirpermitted branch and rooms.- A branch maintains an allow-list of users;only listed users may operate thatbranch's POS.

**Profile-level permission toggles**(configurable per terminal profile)
- **Roles allowed to bill** — theexplicit set of roles permitted to generate a bill and settle payment (defines whocounts as a "billing user").
- **Server/captain transfer permission** — which rolemay reassign an order'sserver.
- **Rolesrestricted fromtableordering** — roles blocked from placing dine-in tableorders.
- **View-all-statuses toggle** — whenoff, cashiers seeonly workingstatuses (draft, unbilled, recently paid); when on, theymayalso browse fully paid, consolidated, and returned orders.
- **Edit/remove-items-after-bill toggle** — controls whether lineitems may be removed orreduced onanorder that has already been billed.- **Cancel permission** — cancellation ofadraft orderis gated by a standard cancel permission check.

**Rule**:Any attempt to bill, settle payment, or takeoverabilled/occupied orderbya userwho is not a permitted billing user must be rejected.---

## 4. StateMachines

Thereare threecooperating statemachines. They are deliberately separate because aphysical table, afinancial document, and a kitchen ticket changestateon different triggers.

### 4.1 Order lifecycle (document state ×billed marker)

Theorder tracks **two orthogonal dimensions**:

**Dimension A — Document state**: `Draft →Submitted(Paid) → [Consolidated]`, plus `Return`and `Cancelled`branches.

**DimensionB — Billed marker**(aboolean on the draft):`not-billed → billed`. Thismarkswhether aprinted bill has been produced,independent of payment.

Combining themyields the operational statuses the UI presents:

| Operational status | Documentstate | Billed marker |Meaning |
|---|---|---|---|
| **Draft (takeaway / billed-table)** | Draft |billed,OR no table | Takeaway order inprogress, or a dine-in order whose bill wasprinted || **Unbilled** | Draft | not-billed AND has table| Dine-in order stillopen atanoccupied table |
| **Recently Paid** |Paid | — | Acapped listof just-settled orders |
|**Paid** | Paid| — |Settled orders |
| **Consolidated** | Consolidated | — | Paid orders rolled upinto a consolidated sales document|
| **Return** |Return | — | Reversed/returned orders |**Transitions**1. **Createdraft** — Onthe first"update"/checkout, adraft order is created (see §5.1). Status=Draft. Ifdine-in:billed-marker = not-billed,and the orderappears as *Unbilled*. Iftakeaway: itappears as *Draft*.
2. **Modifydraft** — Adding,removing, orre-pricing items keeps the orderin Draft andre-derives thetotal. Eachmodification mayspawn kitchen tickets (§4.3).
3. **Bill** — Producing the printed bill sets billed-marker = billed andreleases the table(s) (§4.2). Theorderis still aDraft document(unpaid) but nowshows under*Draft*rather than *Unbilled*.
4. **Settle payment** — Recording payment mode(s)and submitting the documentmoves it to Paid.This is restricted to billing users.
5. **Consolidate** — Adownstream batch processrolls paid orders into a consolidated sales record →Consolidated.
6. **Return** — Apaid order maybe reversed → Return.7. **Cancel** — ADraft order may be voided (subject to cancel permission),which clears itstable and issues a full-cancel kitchen ticket (§4.3).Terminal.**Guardrule**: Anorder whose billed-marker is alreadysetcannot be re-billed orsilently re-edited; astale clientattempting tore-bill must be rejected with an"already billed" outcome.

### 4.2 Table occupancy state

States: **Free → Occupied →(Attention)→ Free**, with a transient **Active** (UI-selection) state.

- **Free** — noopenorder.- **Occupied**— anunbilled draft order is attached;set atordercreation,stampedwith the order's starttime.
- **Attention** — aderived alert state: occupied longer than a configuredattention threshold. Not astored state; computed from occupancy time.
- **Active** —thetable currently selected inthe operator's UI; purely presentational.

**Transitions**
- **Occupy**: creating/attaching a draft dine-in order sets thetable (and everytablein itsmerge cluster) toOccupied with a timestamp.
- **Release**: atable returns to Free when itsorder is **billed**, **cancelled**,or**transferred away**— but only ifno otheropen (unbilled) order referencesthat tableor its cluster. Releasemustbe idempotent and cluster-aware.
- **Transfer**: movingan order to anew table frees the old andoccupies the new (see§5.5).

**Invariant**: A table isOccupied **if and only if** atleast one unbilled draftorder references it (directly or aspart of a merge cluster). Billing,paying, cancelling, or transferringmust never leave a table falsely occupied,and mustnever freea table that stillhas anotheropen order.

### 4.3 Kitchenticket lifecycle

Twoaxes again: **ticket type** (whyit was issued) and **production status** (how faralongitis).

**Tickettype** —set atissue, immutable:
- **New**— first tickets for afreshly placed order.
- **Modified** — issued when itemsare added or quantities increasedon an order that already has submitted tickets.
-**Partially cancelled** — issued whenitems are removed or quantitiesreduced.- **Fully cancelled** — issued when thewhole order isvoided; requires explicit kitchen acknowledgement.
- **Duplicate** — a reprint marker.

**Production status**: `Queued (ready-for-prepare) → Preparing →Served`.**Transitions**
-**Issue**: placing orupdating an order issues tickets.Thesystem compares the newitem setagainst the previouslysubmitted set todecide,per item,whether it is a new/increased line (→Newor Modified ticket)or a removed/reduced line (→Partial-cancel ticket).- **Advance**: kitchen staff movea ticketQueued → Preparing →Served.Serving stamps a serve time and computes elapsed productiontime,then removes the cardfrom the activequeue.Items may be marked served/unserved individually.
-**Confirm cancel**: a full-cancel ticket mustbe explicitly confirmed by kitchenstaff (recordswho confirmed).**Color/άsemantics forthe kitchen display** (presentation,not stored state): newdine-in vs. new takeaway arevisually distinct; modified tickets are one alert color; cancelled/partial tickets are another.Cancelled cards additionally show remaining-vs-original quantities.

**Timing rules**: eachticket has awarning timer (configurable)that flags overdue tickets; an optional audioalert fires on arrival ofa new ticket; optional delay notifications aredispatched to configured recipient roles whena ticket exceedsitsthreshold. A background validator runs ona fixed interval to detect andloginconsistentticket states.---

## 5.Primary Flows

### 5.1Shift gate (precondition foreverything)
-No tablemay be selected andno order createdforthedayunless an**openShift Opening** exists for the operating cashier (submitted andinOpen state).
- Ifthe "require daily closing" optionis enabled, opening a new shift isblocked until the **priorday's** shift is closed.An unclosed prior dayyields a failure thatmust be resolved before proceeding.

### 5.2 Dine-inorder
1. Select room→select table (tableshows Free/Occupied/Attention badge; selecting an already-open table jumps straight toits existing order).
2. Addmenu items (filtered by course, priority, or search; menu reflects theroom- and order-type-specific price list).
3.Add customer andparty size.4. **Update** —creates/updates the draft order, occupies the table, and issuesthe initial (or modified/partial-cancel) kitchentickets.5. **Bill** — produces theprinted bill, sets billed-marker, releases the table.
6. **Make Payment** — abilling user selects payment mode(s)and settles →Paid.

### 5.3 Takeaway/ quick-serviceAsingle unified screen: search item→ tap toadd tocart → add customer → **Update**(creates thedraft, no table) →proceed to the order logor checkout immediately. No table occupancy is involved.### 5.4 Cart operationsIncrement/decrement quantity;openaprecise-quantity dialog with aper-line comment; delete a line; add an order-level comment; viewrunninggrand total and headercontext(invoice id, server, terminal profile, cashier). Actions: **Update**, **Cancel** (voids the draft and clears thetable), **Reprint kitchen ticket**.### 5.5Order-log filtersand actions
Orders arelisted by the operational statuses in §4.1,scoped to the current cashier and branch. The paid/consolidated/returned statuses are visible only when the view-all-statuses toggle is enabled. Per-order actions: Edit, Printreceipt, Makepayment, Cancel.### 5.6 Advanced table/bill operations
- **Tabletransfer** — reassignan openorder to another (unoccupied, same-branch) table;theold table is freed, the newoneoccupied, and openkitchen tickets arerepointed to the new table. **Blocked** if the source ispart of a mergecluster (must unmerge first) and blocked across branches oronto an occupied target.
- **Server/captain transfer** — reassign the order's server;permitted only within the same room andonly to aserver who serves that room.
- **Table merge** — joinseveral tables into oneshared order/cluster; every table in thecluster reflects theshared order's occupancy.
-**Bill merge** —consolidate severaldraft bills (e.g., foronegroup) into one,combining theirline details.
- **Bill split** — moveselected line items from one printed draft bill into a new sibling order,optionally per customer; the neworder starts not-billed.- **Discounts** —availableonlywhen enabled on the terminal profile.

### 5.7Payment settlement
- Onlya billing user may settle. Thesystem clears any provisional payment lines, records the chosen payment mode(s) andamount(s), and submitsthe document toPaid. Split-tender acrossmultiple modes is supported. Errorsduring settlement abort thetransitionandsurface afailure.

### 5.8End-of-day reconciliation
- Eachsub-cashier reconciles their own transactions (cash andper-mode totals) via asub-closing.- Themain cashier performs the day'smain closing.Closing the day is mandatory to complete operations and(withthe daily-closing option) istheprecondition for opening the next day.

---## 6. BusinessRules andInvariants

1. **Shift precondition** — order-taking isimpossible withoutan open shift; next-day opening mayrequireprior-day closure.2. **Singleopenorder per table** — atable(or merge cluster) hasat most one unbilled draft order.Occupancy exactly mirrors the existence of thatopen order.
3. **Billed marker isone-way perbill** — oncebilled, anorder cannot be re-billed;concurrent/stale attempts arerejected.
4. **Tablerelease is conditional and cluster-aware** — atable frees only when noopenorder referencesit oranycluster sibling.
5. **Payment authority** — billing andsettlement arerestricted to permitted billing roles; servers areexcluded.
6. **Occupancy contention** — attempting to open/modify an order ona table already occupied by another(non-billing) user is rejected with arefresh prompt.
7. **Kitchen tickets are append-only and derived** — every orderchange reconciles currentvs. previously-submitted items andemits thecorrectticket type; tickets are never edited in place.
8. **Fullcancellation requires kitchen acknowledgement** — a whole-order voidissues a cancel ticketthat thekitchen must confirm.
9. **Post-bill itemremoval is gated** — removingor reducing items onan already-billed order is blocked unless the profile toggle permits it.10. **Menu/price resolution**— itempricing is resolved againstthe menu'sbound price list for the room and ordertype; amissing price foran item mustfail loudly rather than defaultto zero.
11. **Aggregator orders** — mustresolve theirbranch-specific customer, price list, and payment mode; amissing binding fails the order.
12. **Customer validity** — anorder requires valid customer details (and a validated contact number wherea customer is created).
13. **Transferconstraints** — table transferis intra-branch only, disallowed formerged tables, anddisallowed onto occupied tables; server transferis intra-room only.14. **Kitchenrouting** — itemsroute to the productionunit owning their item group;a unit may filter by order typeand may block takeaway tickets.

---

##7. Edge Cases- **Stale clientre-bill/re-pay** — a second submission againstan already-billed order mustbedetected and rejected,not duplicated.
- **Two operators on one table** — thesecond operator must beblocked andtold to refresh; occupancy mustnot be silently overwritten.
-**Cancel ofa merged/cluster order** — releasing tables must freeevery cluster member and onlyifno sibling retains an open order.
- **Transfer ofa merged order** — must berefused until thecluster is unmerged.
- **Kitchen-ticket creation failure** — mustnot abort the order write; failuresare logged out-of-band and surfaced to operations, while the order itself persists.
- **Removedvs. reduced items** — reducing aquantity and removing a linemust bothproduce a partial-cancelticket reflecting the correct delta (remaining vs. original quantity).
- **Billsplit leaving zero items** — moving allitemsoutof a sourcebill,or moving none, areboundary conditions thesplit must handle deterministically.
- **Reprint**— areprint issues a duplicate-typeticket andmust not be mistaken for a new kitchen instruction.
- **Attention state** — istime-derived, soit must be recomputed onread (occupancy elapsed vs. threshold),not persisted.
- **Prior-day unclosed shift** — blocks new-day opening when the daily-closeoptionis on; must be surfaced as a clear,actionable failure.
- **Order-type-restricted kitchen unit** — an itemwhose ordertype is filtered out atitsunit must not appear on that unit's queue.---

## 8.Printing (behavioral notes)

Bill/receipt printing and kitchen-ticket printingareboth supported, configurable per room and per kitchen unit. Threetransportsare attempted in priority order:(1) a signed-jobdesktop printbridge, (2) network/CUPS printing whenthe bridge is disabled, (3) awebsocket fallback when neither is configured. Producing thebill viaanytransport iswhatsets the billed-markerand triggers table release;the "printed" stateis tracked on the order.Kitchen-ticket reprintis a separate,toggle-gated capability.

---Reference sourceanchors reviewed (behavioronly, no codereused): `FEATURES.md`, `README.md`; order/billing controller `ury/ury/doctype/ury_order/ury_order.py` (functions forordersync, billing, payment settlement, table/server transfer, merge/split, tablerelease); POS API `ury/ury_pos/api.py` (statusfilters, shift open/closevalidation, customer creation); kitchenAPIs under`ury/ury/api/` (ticket generation, display/serve, validation); permission togglesin `ury/hooks.py` and the post-bill item-removal hook. All descriptions above are neutral restatements of observed behavior.