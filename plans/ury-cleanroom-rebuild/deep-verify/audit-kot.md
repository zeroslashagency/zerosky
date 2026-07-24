I haveenough toproduce the verification. Letme confirm one last thing abouttheorder cancel and whether KOTs are touched oncancel.

The order.cancel handler (lines 224-246) only updates orderstatus, never touchesKOTs. Ihave complete coverage now.---# KOT/KDS Deep-Verification vs spec-spec-2-kot-kds.md

Legend: ✅ implemented ·🟡 partial/degenerate · ❌missing##§2 Domain Entities
-❌ **KitchenTicket immutability/append-only** — `Kot` (schema.prisma:335-352) is amutable row; `setStatus` (kot.ts:79-95) edits it in place. No submit/docstatus concept.
-🟡 **Ticket kind vs servicestatus asseparate fields** — spec §3/§11 mandate twoorthogonal fields (kind fixed,status mutating). Implementation collapses bothinto a **single**`KotStatus` enum `{NEW,MODIFIED, PARTIAL, READY, SERVED, CANCELLED}` (schema.prisma:61-68;kot.ts:5-12). NEW/MODIFIED/PARTIAL are "kind"; READY/SERVED/CANCELLED are "status"— jammed into one axis. **Thisis the centralarchitectural miss (dual-axis lifecycle).**
-❌ **Ticket Line Item entity** — nodedicated model. Lineitems are just`OrderItem`rows re-pointed via`kotId` (schema.prisma:312,327). No `cancelledQuantity`, no per-item comment ontheticket, no course metadata.
-❌ **Kitchen Station (Production Unit)** — nomodel. `station` is a free-text `String?` on `Kot` (schema.prisma:339) andanoptional inputstring (kot.ts:17). No POS profile,categories, printers, or displaysettings.
- ❌**Station Item-Category Binding** — nomodel;routing inputdoesnot exist.
-❌ **Station Order-Type Filter** — nomodel.
- ❌**Printer Binding (profile/station/roomscopes +suppress-takeaway flag)** — noneinschema.`print` package hasonly transport-level discovery (discovery.ts)withno DB-backed bindings orscopecascade.
-❌ **TicketError Log** — no model.- ❌ **Notification Recipient Role** — no model.
-❌ **Cancellation-ticket → original-ticket reference** — noself-relation on`Kot`.

##§3 Kinds & Service-Status StateMachines
- ❌**Twoorthogonal state dimensions** — single-axis enum only(see above).
- ❌ **Document submit/cancel lifecycle**— nosubmit step; `printedAt` (schema.prisma:341) is theonly lifecycle timestamp.-🟡 **Kind set** — NEW /MODIFIED / PARTIAL exist asvaluesbutarenever auto-assigned.`generate` always hard-codes `status: "NEW"` (kot.ts:41); MODIFIED andPARTIAL are unreachable from anycode path.
- ❌**Duplicate kind** — notin enum; noreconciliation tocreateit.
- ❌**Served stamping (servedTime + productionDuration)** — spec §3.2/§8.7require stamping servedAt and computed minutes ontheServedtransition. `setStatus` (kot.ts:91-94) writes only `status`; no `servedAt`/`prepStart`/`duration` fields exist on`Kot`.
-❌ **Verificationsub-state (`verified`/`verified_by`)** — nofields; noConfirm transition.Cancellation tickets cannot be acknowledged.
-❌ **Status forward-only enforcement** — `setStatus` accepts any enum value with no transition guard (kot.ts:91-94); statuscan movebackwardorto CANCELLED freely.

## §4Core Flows
-❌ **§4.1 Diff-based generation (positive/negative/removed deltas)** —`generate` doesno diff.It grabs `kotId ===null && status ==="PENDING"` items(kot.ts:26-28) and connects allof them. No previous-listcomparison, no delta tickets.
- ❌**§4.1Naming seriesfromPOS profile / cancel-prefix series** — `nextKotNumber()` (kot.ts:11-13) is a `Date.now().toString(36)` stub.No series, no mandatory-series error, nocancel prefix.- ❌ **§4.2 Course/menu resolution** — absent; no menu-by-room/branch lookup, no serving priority /indicate flag.
-❌ **§4.3Station routing (multi-kitchen)** — **completely missing.** Station is asinglefree-text fieldononeKOT; thereis no category→station union, no per-station partition, no "nostation configured" block, no "item inno category" warning. One `generate` call=exactly one KOT (kot.ts:36-47), never fan-out.
-❌ **§4.4Full-order cancellation→per-stationCancelled tickets +document-cancel activetickets** — `order.cancel` (order.ts:224-246) only sets `order.status = CANCELLED` and stores thereason. It never creates aCancelled KOT and never touches existing KOTs ortheir items.
- ❌ **§4.5 Table change(in-place tablerelabel +channel refresh)** — no table-move endpoint atall (`table.ts`has no move/transfer/merge;grep empty). No KOT relabel, no merged-tablelabel.
- ❌**§4.6 Reconciliation safety-net job(every minute,1–5 min window, idempotent, Duplicate tickets + error log)** — noscheduler, no cron, no job anywhere.- ❌ **§4.7 Ticketreprint (profile flag + format+ order-type printer selection)** — `markPrinted` (kot.ts:97-113) just stamps `printedAt`; no reprintgating, no printer selection byordertype.

## §5Printing-🟡 **KOTESC/POS template** — `buildKot` (templates/kot.ts:15-42) renders station label, KOT number, order number, table/type, items, modifiers, notes.Solid atthe byte-rendering layer.- ❌ **Printer resolution cascade (station →room → profile fallback)** — notimplemented;no scope modeltocascade over.
- ❌ **Suppress-takeaway-at-station-printer** — nosuchflag orlogic.
-🟡 **Print failures non-fatal** —queue.ts hasretry,but generation nevercalls print, so submit-timeprinting is notwired toKOT creation at all.## §6 Kitchen Display (KDS)
- ❌**Per-station displayscreen /KDS view** — no KDS app/page. Only `apps/pos-web/components/kot/kot-preview.tsx` (172lines) —a print-preview component, not a liveboard.
-🟡 **§6.1 Active-tickets query** — `list` (kot.ts:64-77) filters by branch/order/status andorders `createdAt asc`.Missing: submitted/verified/3-hour-window filters,"newest first"(spec wants newest first;codeisasc), station-match,order-type filter. Served-view parallel query absent.
- ❌**§6.1 Real-time push (per branch+station channel)** — **no realtime anywhere.**Grep for subscription/observable/EventEmitter/publish/redis/pubsub/websocket in`packages/api/src` returned nothing.No tRPC subscription,no channel keying.
- ❌**§6.2 Cardcontents /§6.3 color coding /§6.4 line-item strike / §6.5Serve+Confirm actions / §6.6 timers,audio alert, delay notification** — noneexist (no KDS surface).
- ❌**§6.6Delay notification backend** — no notification/alert creation path.

##§7Ordinal Order Numbering
-🟡 **Humanorder number** — `Order.orderNumber` exists,unique per branch (schema.prisma:281,300). Butspec'sper-shiftordinal, aggregator-prefixed counter,invoice-baseline computation, andreset-daily flag are allabsent.

## §8BusinessRules &Invariants
-❌ Rule 1 (mandatory series) ·❌ Rule 2(≥1 station) ·❌ Rule 3(one ticket per station)· ❌ Rule4 (append-only)·❌ Rule 5(kind immutable/status forward-only) ·❌ Rule 6(auto New-vs-Modified) ·❌ Rule7 (served stamping)· ❌ Rule8 (active-display invariant) · ❌Rule 9 (atomic full-cancel) · ❌Rule 10 (generation swallowed + idempotent backstop —currently `generate` **throws** on no-pending,kot.ts:29-34, which wouldbreakordering if inlined) · ❌Rule 11 (cancel refs originals) ·❌ Rule12 (course sort) · ❌Rule 13 (takeaway suppression) ·❌ Rule14 (perbranch+station channel) · ❌Rule 15 (delayfires once).- ✅ **Tenant scoping** — everyKOT query/mutation scopes through`order.branch.tenantId`(kot.ts:20,68,85,102).This invariant (implicit in§10branch scoping) is correctly enforced.

## §9Edge Cases
-❌ All spec edge cases (no-station item, N-station fan-out, partial-qty old/remaining display, tablemoverelabel, merged tables, aggregatorcounter, offline refetch, audio prompt, 3-hourage-off, Cancelled-pushdelayed refresh, un-confirm) —none handled.

## §10Permissions
-🟡 **Role gating presentbut coarse** — `generate`=OWNER/MANAGER/CASHIER/WAITER (kot.ts:16); `setStatus`/`markPrinted` addKITCHEN (kot.ts:79,97); `order.cancel` = OWNER/MANAGER only (order.ts:224). Reasonable RBAC skeleton.- ❌ **Profile/roomscoping, KDS auth-gate+login-redirect, Confirm-records-verifier, reprint gating,role-based delayrecipients** — none(featuresdon't exist).

---## Summary of the three flagged gaps

1.**Dual-axis lifecycle —❌ MISSING.** Kind and service-status are merged into one `KotStatus` enum (schema.prisma:61-68).No`verified`/`servedAt`/`prepStart`/`duration`fields, no submit/document-cancel state, no Duplicate kind.Status transitions areunguarded (kot.ts:91-94). MODIFIED/PARTIAL valuesexist but are neverproduced.

2. **Stationrouting — ❌ MISSING.** No `KitchenStation`,no item-category bindings.`station` is free-text on a single KOT (schema.prisma:339);`generate` produces exactly one KOT per callwithallpending items (kot.ts:36-47).No fan-out, no category→station resolution, no "no station"/"no category" guards.`order.cancel` nevergenerates cancellation KOTs or document-cancels activeones (order.ts:224-246).

3. **Realtime — ❌MISSING.** No subscriptions, EventEmitter, pub/sub,Redis, or websocket in`packages/api/src`. Noper-branch+station channel, no push-on-submit, no KDS boardconsuming it. `list` (kot.ts:64-77) is aplain poll querymissing the submitted/verified/3-hour/order-type/station filters andsortsascending instead of newest-first.

**Overall:** The KOT/KDS subsystem is an earlyskeleton. Whatexists —a single-axis `Kot` model,aone-shot `generate`, plain `list`/`setStatus`/`markPrinted`, tenant scoping, and acompetent ESC/POS `buildKot` template — isroughly 1of thespec's~11 functional sections. Stations, routing, dual-axis lifecycle, cancellationticketing, reconciliation,reprint, printer-scope cascade,ordinal numbering, andthe entire realtime KDS surface are absent.

Keyfiles: `/Users/xoxo/Documents/resreah/billing/zerosky-repo/packages/api/src/routers/kot.ts`,`/Users/xoxo/Documents/resreah/billing/zerosky-repo/packages/api/src/schemas/kot.ts`, `/Users/xoxo/Documents/resreah/billing/zerosky-repo/packages/database/prisma/schema.prisma` (lines 53-68, 308-352), `/Users/xoxo/Documents/resreah/billing/zerosky-repo/packages/api/src/routers/order.ts` (lines 203-246), `/Users/xoxo/Documents/resreah/billing/zerosky-repo/packages/print/src/templates/kot.ts`, `/Users/xoxo/Documents/resreah/billing/zerosky-repo/packages/print/src/types.ts` (lines 64-72), `/Users/xoxo/Documents/resreah/billing/zerosky-repo/apps/pos-web/components/kot/kot-preview.tsx`.