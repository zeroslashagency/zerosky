I now have fullcoverage. Here is theitemized verification checklist.---

#ORDER LIFECYCLE + BILLING—DeepVerification vs `spec-spec-1-pos-order-lifecycle.md`

Files audited: `packages/api/src/routers/{order,table,payment,kot}.ts`, `schemas/{order,payment,table,common}.ts`,`packages/payments/src/{state,multi-tender,money,types}.ts`, `packages/database/prisma/schema.prisma`.Headline: the money/split/stateprimitives in `packages/payments` are correct inisolation but**almost none ofthem are wired into the API**(`grep` for `@zerosky/payments` / `settleSplit` / `canTransition`in `packages/api/src` →zero hits). The order/table/payment routers arethin CRUD withno cross-entity invariants. The twoorthogonal state machines thespec centers on (document-state ×billed-marker, andtable-occupancy⇔ open-order) are effectively absent.

## §3 —Actors &Permission Requirements

-🟡 **Server/captain cannot takepayment**— `payment.record` =`roleProcedure("OWNER","MANAGER","CASHIER")`, WAITER excluded (`payment.ts:13`).Correct forthe payment router. BUT seeBUG-1:`order.setStatus`lets WAITER/CASHIER/**KITCHEN** moveanorder to `PAID`/`BILLED` (`order.ts:203`),bypassing billing authority entirely.- ❌ **Profile-level toggles** (roles-allowed-to-bill,transfer permission, restricted-from-table-ordering, view-all-statuses, edit-after-bill, cancel permission) — no TerminalProfile entity, no toggles anywhere inschema orrouters.
- ❌**Record scoping torooms /branch allow-list** — onlytenant scoping exists (`branch: { tenantId }`). No per-userbranch/room permission list.

## §4.1— Order document-state × billed-marker- 🟡 **OrderStatus enum**(`schema.prisma:43`OPEN/SENT_TO_KITCHEN/READY/SERVED/BILLED/PAID/CANCELLED) exists but does**not** model the spec'stwo orthogonal dimensions. Thereis **no billed-marker** distinct from document state,so"Draft-billed vs Unbilled" (§4.1table) is unrepresentable.`discountTotal` column exists (`schema.prisma:287`) but no API writes it.
- ❌**BUG-1 (setStatus any→any):** `order.setStatus` (`order.ts:203-222`) accepts any`orderStatusSchema` value and writes it directly (`data:{status:input.status}`), with the*only* guard being "not fromCANCELLED"(`order.ts:212`). SoOPEN→PAID, PAID→OPEN, SERVED→OPEN, READY→BILLED, PAID→BILLED areallpermitted. No transition table,no forward-only enforcement. Thisis the concrete bug flagged inthe task,confirmed.
-❌ **Guard rule "cannot re-bill /stale re-bill rejected"** (§4.1,§6.3,§7)— nothing sets orchecks a billed marker;astale clientcan re-drive statusfreely.
- ❌**Bill step** (print→set billed-marker →release table) — no `bill` procedure atall.
- ❌**Settle payment →Paid** — `payment.record` (`payment.ts:13-38`) creates aPayment row and **never updates `order.status`**.A fully-paid order stays OPEN/SERVED. Reaching PAID is only possible via the buggy manual `setStatus`.
- ❌**Consolidate/ Return** documentstates — not presentin enum or code.- 🟡**Cancel** —`order.cancel` (`order.ts:224-246`) sets `CANCELLED`,blocks cancelling a PAID order(`order.ts:233`), OWNER/MANAGER-gated. Reasonable, BUT does**not** release the table and does**not** issue a full-cancel KOT (§4.3/ rule 8).## §4.2 —Table occupancy state(the coreinvariant)

-❌ **BUG-2(occupancy never set):** `order.create` (`order.ts:104-131`) writes `tableId` but neversets the table to OCCUPIED. `order.ts`contains no reference to table`state`at all (grep confirmed).The§4.2/§6.2invariant "tableOccupied iff≥1 unbilled draft order references it" is entirely unenforced.
- ❌**BUG-3(norelease):** billing, paying, cancelling, transferring never returna table to AVAILABLE. Noidempotent,cluster-aware release logic exists.
-❌ **BUG-4(setStateany→any):** `table.setState` (`table.ts:68-81`) writes any`TableState` unconditionally (`data:{state:input.state}`)— notransition validation, andcrucially it'sthe*only* thing thatever changes table state, so occupancy is apurely manual free-text fielddecoupled from orders.WAITER cansetanystate.
- ❌**Occupancy timestamp / Attention** — `Table` has no `occupiedAt`;TableState enum (`schema.prisma:28`) has noACTIVE;Attention/Active statesandthe time-derived threshold (§4.2, §7)are absent.
-❌ **No validation that `tableId` belongs tothe branch/tenant**in `order.create` (`order.ts:107`) — accepts an arbitrary/foreign table id (weak-FK isnullable-optional).Also no check the table is freebefore seating.## §4.3 —Kitchenticket lifecycle- 🟡 **KOT generate** —`kot.generate` (`kot.ts:16-62`) creates a`NEW` KOTfrom `kotId===null && status===PENDING`items, flips them toPREPARING, and moves orderOPEN→SENT_TO_KITCHEN. Reasonable first-ticket path.Note: order items arecreated withdefaultstatus`PENDING` (`schema.prisma:321`), so thisworks.
- ❌**BUG-5 (noticket-type derivation):** `order.addItems` (`order.ts:133-175`) appends items and recomputes totals but neverissues a MODIFIED KOT;removing/reducing neverissues a PARTIAL cancel KOT; `order.cancel` never issuesa FULLY-cancelled KOT. The"diff currentvs previously-submitted" engine (§4.3, rule 7) doesn'texist. Thereis no remove/reduce-item procedure at all.-🟡 **KotStatus enum**(`schema.prisma:61`) conflates ticket-*type* (NEW/MODIFIED/PARTIAL/CANCELLED) with production-*status* (READY/SERVED) into one field— the spec's two axes can't bothbe represented.
- ❌**Full-cancel kitchenacknowledgement** (who confirmed)— nofield,no flow.- ❌ **Duplicate/reprintticket,warning timers, audio/delay alerts, background validator, station routing by item-group, order-type-filtered units** — none present.`Kot.station` is free-text (`schema.prisma:339`).-🟡 **markPrinted** (`kot.ts:97-113`) stamps `printedAt`. Exists;not tied to reprint=duplicate semantics.## §5.1 —Shift gate

-❌ **Entirely missing.** NoShift/ShiftOpening/SubClosingmodelin schema, no shift router.Orders can becreated withno openshift;next-day-blocked-until-prior-close(§5.8, rule 1) absent.

## §5.2–5.4— Dine-in / Takeaway /Cart-✅ **Pricedordercreate** —`priceLines` (`order.ts:33-82`) loads tenant-scoped items,computes per-line net/tax/totalandordersubtotal/tax/grand with `Prisma.Decimal`(nofloat).`order.create` persists snapshots (name/unitPrice/taxRate/lineTotal). Solid.
-✅ **Fail-loud missing price** (rule 10) — unknownitem idthrows NOT_FOUND (`order.ts:55-60`); `Item.price`is a requiredDecimal so itcan't silently default to zero.
-🟡 **addItems totals**— correctly adds toexisting totals (`order.ts:157-159`). GuardsPAID/CANCELLED (`order.ts:142`) but **not BILLED** →itemscan be added to a billed order withno post-bill toggle gate (violates rule 9).Also no KOT re-issue (BUG-5).
-🟡 **Takeaway (no table)** — supported implicitly (`tableId` optional). Nooccupancy involved, whichis correct,but nothing distinguishes theoperational "Draft" vs"Unbilled" presentation (nobilled marker).
-❌ **Cart decrement/delete-line, order-level comment asdistinct from notes, reprint** — noquantity-edit or line-delete procedure exists.
-⚠️ **Minor:** `nextOrderNumber`=`ORD-${Date.now().toString(36)}`(`order.ts:84`) risks collision under concurrencyagainst `@@unique([branchId,orderNumber])`;no per-branch sequence.

## §5.6 — Advanced table/bill ops

- ❌**Table transfer, servertransfer, tablemerge, bill merge, bill split, discounts** — noneimplemented. Nomerge-cluster concept in schema. Allof§5.6 andrules 13missing.

## §5.7 — Payment settlement /multi-tender

-❌ **BUG-6 (split engine notwired):** `validateSplit` /`settleSplitPayment` (`multi-tender.ts:43-105`) correctly validate tenders sum togrand-total to the paise and setCASH/COMPLIMENTARY→CAPTURED, gateway→PENDING.**Neverimported by`payment.record`.** Therouter (`payment.ts:13-38`) creates one arbitrary payment with client-supplied `status` (default CAPTURED via `payment.ts`schema `paymentStatusSchema.default("CAPTURED")`, `schemas/payment.ts:27`) —so a CARD/UPI tender can be marked CAPTURED withno gateway flow, and there is **no checkthat payment amount matches ordergrandTotal** (over/under/partial allaccepted,no runningbalance,no →PAID transition).
- ❌**BUG-7 (payment state machine notwired):** `payment.setStatus` (`payment.ts:80-93`) writes any `PaymentStatus`unconditionally. `state.ts`'s `transition`/`canTransition` (PENDING→CAPTURED/FAILED, CAPTURED→REFUNDED only) is never called. So REFUNDED→CAPTURED,FAILED→CAPTURED, CAPTURED→PENDING areall allowed —the exact classof bug the state machine wasbuilt to prevent.
-🟡 **refund** (`payment.ts:53-78`) —correctly restricts to `status==="CAPTURED"` and OWNER/MANAGER.BUT it mutates the row to REFUNDED in place rather than writing a reversing entry;no partial refund (amountignored);`packages/payments/src/refund.ts` notused.
- ✅**Money precision** — `money.ts` (paise integers, `toPaise`/`sumRupees`/`rupeesEqual`) is correctandguards NaN/negative/non-finite. `moneySchema` (`common.ts:12`) enforces ≤2decimals. Good—justunder-used atthe routerlayer.
-❌ **"Clear provisional paymentlines beforesettle"** (§5.7) — no concept ofprovisional lines.

##§5.8 — End-of-day reconciliation- ❌ **Missing.** No sub-closing / main-closing.(`packages/payments/src/reconcile.ts` exists but is not surfaced through anyrouter—notaudited indepth perscope,but notwired.)

## §6 /§7 — Invariants & Edge cases (net)

- ✅ rule 10(fail-loud pricing). 🟡rule 5(paymentauthority —holds inpayment router,broken viasetStatus BUG-1).
- ❌rules 1(shift), 2 (single open order pertable / occupancy mirror), 3 (billed one-way), 4(conditional cluster-awarerelease), 6 (occupancy contention /two-operator refresh), 7 (append-only derived KOTs), 8 (cancel needs kitchenack), 9 (post-bill removal gate),11 (aggregator bindings), 12 (customer validity — no Customermodel,only `guestCount`),13 (transfer constraints), 14 (kitchen routing).
-❌Edge cases: stale re-bill, two-operators, cluster cancel, merged transfer, KOT-failure-must-not-abort-order, reduced-vs-removeddelta, split-to-zero, reprint=duplicate, attention recompute, prior-day-unclosed, order-type-filtered unit — nonehandled.

## Confirmed BUGS(actionable)

1. **`order.setStatus` any→any transition** (`order.ts:203-222`) — no state machine; onlyblocks source=CANCELLED.Allows PAID→OPEN, OPEN→PAID,etc. KITCHEN rolecan reach PAID/BILLED (payment-authority bypass).
2. **Table occupancy never set onorder create** (`order.ts:104-131`) — §4.2 invariant unimplemented.
3.**Table never released** on bill/pay/cancel/transfer (`order.ts:239`cancel leaves table stateuntouched).
4. **`table.setState` any→any** (`table.ts:77-80`) — unconditional write, WAITER-writable, decoupled from orders.
5. **KOT type-derivation absent** — `addItems`/`cancel` issue no MODIFIED/PARTIAL/FULL-cancel tickets (`order.ts:133-246`);no remove/reduce path.
6. **Split-payment engine unused** — `settleSplitPayment`/`validateSplit` notimported; `payment.record` (`payment.ts:13-38`) takes arbitrary amount+status, nevervalidates against `order.grandTotal`,never drives order→PAID.
7. **Payment state machine unused** — `payment.setStatus` (`payment.ts:80-93`) bypasses`state.ts` `canTransition`; permits illegal REFUNDED→CAPTURED etc.8. **`addItems`doesn't blockBILLED orders** (`order.ts:142`guards only PAID/CANCELLED) — post-bill edit gate (rule 9) missing.9. **Payment default status CAPTURED forgateway methods** (`schemas/payment.ts:27`) — CARD/UPI can bebooked captured with no gatewayconfirmation; contradicts`multi-tender.ts:9-13` INSTANT_METHODS intent.Minor: unvalidated `tableId` origin in `order.create`; `nextOrderNumber`/`nextKotNumber` timestamp-base36 collision risk underconcurrency.

Bottom line: the create/price/readpaths are sound and moneymathis correct,but everylifecycle *invariant* thespec is about— billed marker, occupancycoupling, state-machine-guarded transitions (order, table, andpayment), settlement-drives-PAID, splitvalidation, KOT derivation, shift gate —is eithermissing or bypassed.Thetwomostsevere are BUG-1(orderstatusfree-for-all) and BUG-2/3 (occupancy neversetor released).