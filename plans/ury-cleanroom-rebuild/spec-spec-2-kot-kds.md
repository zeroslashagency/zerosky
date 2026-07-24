I havecomplete coverage of the subsystem. Here is theneutral functional specification.---

# FunctionalSpecification:Kitchen Display&Order-RoutingSubsystem (KOT/KDS)

##1. Purpose

Thissubsystem bridges the point-of-sale (POS)ordering flow and the kitchen.When a serverplacesorchanges an order, the subsystem translates theorder's lineitems into oneor more **kitchen tickets**, routes each ticket to the correct kitchen station basedon the itemcategories thatstation isresponsible for, prints theticket atthatstation's configured printers, and displays itlive on a per-station kitchen display screen.Kitchen staff usethe displayto track preparation andmark tickets servedoracknowledge cancellations. Thesubsystem also runs asafety-net reconciliation job tocatch orders that failed to generate aticket, and itnotifies designated staff when tickets sit too long.Key design goalsreflected in the behavior:
- Oneordercanfan out into multiple tickets, one per kitchenstation that owns at least one of theorder's items.
- Everyordermutation (add,increase,decrease, remove, cancel) producesa *new* ticket describing the delta,rather than editing an existing ticket.Tickets are anappend-only audit trail.
- Thedisplay is real-time (push-updated) withapolling/fallback refresh.---

## 2. Domain Entities (concepts,not schemas)

-**Order** — ThePOS-side sales document foronecustomer visit/transaction. Carries anorder type (e.g., dine-in, takeaway, delivery, phone-in, third-party aggregator), anoptional tablereference, acustomer, aserved-by user (waiter/captain), a POS profile,abranch, and anordinal per-shift order number. Thisis the upstream source;thesubsystem reads from it buttheOrder itself is owned bythe billing flow.- **KitchenTicket (KOT)** — Thecentralentity of this subsystem.Animmutable, submittable recordrepresenting one instruction batch sent to one kitchen station. Holds: the originating order reference, aticket kind,a servicestatus, the targetkitchen station, table/takeaway context, customer, timestamps (createddate/time, prep-start time, servedtime, computed productionduration), afree-text order-level comment, averified flag +verifier, the ordinal order number, aggregator metadata, and a childcollection ofticket lineitems. Forcancellation tickets italso stores a reference backto the original ticket(s) whose items arebeing cancelled.

-**Ticket LineItem** — A childrowunder aKitchen Ticket: item reference, itemname, quantity, a "cancelled quantity"(usedon cancellation tickets), anoptional per-item comment, andcoursemetadata (whichmenu course theitem belongs to, thatcourse's servingpriority, and a flag indicating whether the courseshould be surfaced on the display).- **KitchenStation (Production Unit)** —Anamedpreparation area(hot line, bar, dessert, etc.).Owns: aPOS profile andderived branch/warehouse, a listof **item categories** itisresponsible for, a listof printers,andoptional display settings. Each stationmaps to its own kitchen display screen,addressed by station name. Thisis the routing target.

- **StationItem-Category Binding** — Achild rowundera station listing oneitem category thestation handles. Theunionof theseacross an order'sitems determines which stations receive tickets.

- **Station Order-Type Filter** —Optional child rows under a station. When thestation's "order-type-wise display" toggle is on, onlyorders whose order type appears in this list are shown/pushed to that station's display (and pushed inreal time).Whenoff, thestation shows all order types.- **Printer Binding** — A printer +print-format + enable-flag,attachable at threescopes: the POS profile, the kitchen station, and the room.A station printer binding may additionally carry a"suppress takeaway tickets" flag.

- **Ticket Error Log** —A recordwrittenbythe reconciliation job when itdetects an order that neverproduced a ticket and hadto create one afterthe fact. Stores theticket reference, orderreference, and the order's originalcreation time (for lateness analysis).

- **Notification RecipientRole** —Child rows on the POS profile naming the roles that should receivea systemalert when a ticket isdelayed.

### Relationships- One Order →zero-or-moreKitchen Tickets (one per involved station permutation event).
- OneKitchen Ticket → oneKitchen Station; →manyTicket Line Items.
- Acancellation ticket →references one or more originating tickets (the"NewOrder"/"OrderModified" tickets thatcontained the cancelled items).
- One Kitchen Station → manyItem-Category Bindings,many Printer Bindings, manyOrder-Type Filters,one display screen.
-Item category(ofanitem) → matched againstStation Item-Category Bindings to route.
- Menu course(of an item) → drives displaygrouping and sort order onthe ticket.---

## 3.Ticket Kinds andService-Status State MachinesThereare **two orthogonal state dimensions** ona ticket:its**kind** (fixedat creation,describes whytheticket exists) and its**service status** (mutates asthekitchen worksit).Thereis also thedocument-levelsubmit/cancel lifecycle.###3.1 TicketKind (assigned onceat creation, thenread-only)- **New Order** — first-time itemsoradded/increased quantities beingsent toprep.
- **OrderModified** — items sent to astation that already has a submitted,activeticket for thisorder;the *added* portion isdescribed here.(Determined automatically: if asubmitted ticket already exists for this order+station, afurtherpositive-quantity batch is labelledModified rather than New Order.)
- **Partially cancelled** — someitems were removed or theirquantity reduced whilethe order remains active.
- **Cancelled** — the entire order was cancelled.- **Duplicate** — created onlyby the reconciliation safety-net job whenitfinds an order that should have had aticket but didn't.Flagged on the display asneeding manual verification withthe server/captain.

Kind nevertransitions; achangetotheorder creates a new ticket oftheappropriate kind.### 3.2 ServiceStatus statemachine (perticket)
States: `Ready ForPrepare` (initial/default) → `Served` (terminal).

```[create+submit]──► Ready For Prepare──(kitchen "Serve"action)──► Served
```-Aticket isbornin`Ready For Prepare` on submission.
- The onlybackendstatustransition implemented is to`Served`, triggered by the kitchen operator'sserve action. On thattransition the systemstamps the served time and computesproduction duration =(now−ticket creation time) in minutes.
-Cancellation-kind tickets do **not**usethe serve transition; theyusetheverificationtransition instead (below).- (Thedisplaypresents an informal"New→Preparing → Ready→ Serve" progression tostaff, butthe persisted,authoritative status valuesare only `Ready ForPrepare` and `Served`. Animplementermay keep thetwo-valuepersisted modelor extend it,but mustpreserve the served-time/duration stamping oncompletion.)

### 3.3 Verificationsub-state (cancellation tickets only)
Independent boolean `verified`(default false)plus a`verified_by` user.```
verified = false ──(kitchen "Confirm" action on aCancelled/Partially cancelled ticket)──► verified = true (+ recorded verifier)
```

-OnlyCancelled /Partially cancelled tickets require the kitchento confirm receipt. Confirming sets `verified = true` and records whoconfirmed.
- Theactive-display queryexcludes verified tickets, so confirming removes acancellation card from the screen.### 3.4 Documentlifecycle (submit/cancel)- Tickets are submittable documents.Creation =insert **then** submit;printing and thereal-time displaypush bothfire on submit.
- Whenanentire order is cancelled,the subsystem (a) creates a new**Cancelled**-kind ticket capturing allitems, and (b) transitions everystill-active submitted ticket forthat order (kinds New Order andOrder Modified) intothe document-cancelled state.---

## 4.Core Flows

### 4.1Ticket generation on order place / updateTriggered whenever the orderis saved fromPOS withitsitem list. Inputs:orderreference, customer, optional table, thecurrent item list, the previous itemlist, and anoptional order-level comment.

Algorithm:
1. **Diff** currentvs. previous item liststoderive:
   - *Positive deltas* — newitems orincreased quantities (quantity difference > 0).
   -*Negative deltas*— reduced quantities (difference ≤ 0).- *Removed items* — presentbefore,absent now.
2.Resolve theticket naming series from the POS profile(mandatory;errorif missing). Derive thecancellation naming series byprefixing the baseserieswith a fixed cancel marker.
3. If thereare positive deltas →run**station routing** (§4.3) and createoneprep ticket per involved station,eachkind =New Order (auto-upgraded toOrder Modified perstation if thatstation already has an active ticketfor this order).
4. Ifthere are negative deltas orremoved items → createper-station **Partially cancelled** tickets describing the cancelled quantities,eachlinking back to the original ticket(s) thatcarried thoseitems.
5.Ticket generation iswrapped so thata failure does not roll back the underlying order save; failures are swallowed atthe orderlayer (the reconciliation job isthe backstop).

### 4.2 Course/menu resolution forline items
For each item ona ticket, resolve its **course** from the menu applicable to the order'scontext:
- If theorder has a table →usethe menu bound to that table's room(room-and-restaurant-specific menu binding).
- Otherwise (takeaway/notable) → use the branch restaurant's active menu.The resolved course carries aserving priority and an"indicate ondisplay" flag, bothcopied onto theline item fordisplay sorting and grouping.

### 4.3 Station routing (multi-kitchen)
-Gather all kitchen stations for the order's branch.
- For eachitem, look up its **item category**; collect the unionof all categories owned by any station.If an item's category is owned by **no** station, surface a warning to the operator(theitem stillwon't be routed anywhere).
- For eachstation: selectthe subset of the order's (delta) items whose category is inthat station's owned categories. If thatsubset is non-empty,create a ticket for that stationcontaining only those items.
- Ifthebranch has **no** stations configured atall, blockwithan error instructing setup ofa station againstthe POS profile.
-Net effect: anordertouching threestations' categories yields three separate tickets, each showing only thatstation's items.

### 4.4Full-order cancellation
Triggered bythe order-cancel action(with areason,handled upstream). Builds anall-items cancellation payload, runs itthrough per-station cancellation-ticket creation (kind= Cancelled),then document-cancels all activeprep tickets for that order.Table release ishandled by the billing flow,not here.

### 4.5 Table changeWhen anactiveorder ismoved to a different table, everystill-active,unverified,`Ready For Prepare` ticket for that orderhas its table reference updated inplace (thisis theone permitted in-placeticket field change),and a real-time refresh signal is pushed to each affected station's channel so displays relabel immediately. Merged-table contextis preserved andrendered as a combined label.### 4.6Reconciliation safety-net (scheduled,every minute)
Ajob scans for orders that are stillin the pre-submit (draft)documentstate and were created between 5minutes and 1 minuteago (asettling window).For each such order thathas **no**ticket created aftertheorder's creation time, it routes theorder's items acrossstations and creates **Duplicate**-kind tickets for theinvolved stations, thenwrites aTicket Error Logentry. This catches orders where liveticket generation silently failed. Duplicate tickets are visually flagged on the display formanual verification.

###4.7 Ticketreprint
Ondemand foran order:gated by aper-profile "enable reprint" flag anda configured reprint printformat (both mandatory ortheaction errors). Theprinter is selected by ordertype — table-orderprinter for dine-in,parcel printer otherwise—and must be assigned orthe action errors. Reprintis aserver-side print job; failures are logged.---

## 5.Printing (onticket submit)

Onsubmission, aticket prints to aresolved setof printers usinga priority/scope cascade:

1. **Stationprinters** (printers bound to theticket's kitchen station with printenabled). If astation printer carries the"suppress takeawaytickets" flag, it prints only for genuine dine-in tickets (table presentand not atakeaway table); otherwise it alwaysprints.
2. **Room printers** —additionally, for dine-in(tablepresent, not takeaway),printers bound to that table's roomalsoprint.
3. **POS-profile printers** — usedas thefallback when neither station nor room printers produced output fortheticket (andalwaysfor thenon-dine-in branch whenno station-levelroom logic applies).

Eachprint jobpairs a printer with itsown KOT print format. Printfailures are non-fatal (swallowed) so theynever block ticket creation or display.(The broader systemsupports multiple print transports —signed localprinting, network/CUPS printing, and awebsocket fallback — selected by configuration; fromthissubsystem's view,printing is "sendticket to resolved printersvia theserver printmechanism.")

---

## 6.Kitchen Display (KDS) BehaviorEach kitchen station has its own displayscreen addressed by station name. The screen:

### 6.1Data sources
- **Initial/refresh load**: queries activetickets for the branch —thosewith status `Ready ForPrepare`, submitted, **not**verified, ofanyrelevant kind, created within thelast 3 hours —newest first. A parallel queryexists for recently `Served` tickets (same window/filters) for a servedview. The client filters the returned setto onlycards whose station matches the screen's station.
- **Real-timepush**: subscribes to a per-stationchannel keyed by `branch` + `station`. On each ticket submit, the backend publishes theticket payload (plus thealert sound pathand a last-ticket-time marker) to that station's channel. The client prepends the new card, recolors, and re-lays out. For **Cancelled** pushes, theclient triggers a fullrefresh shortly after (to alsodrop the now-document-cancelled prep cards).
- **Order-type filtering**: ifthestation has order-type-wise display enabled, both the queryand the real-time push drop tickets whose order'stypeisn't in thestation's allowed list.- **Connectivity**: theclient tracks online/offline;on reconnect it refetches.Aminute-interval timer recomputes elapsed times.

### 6.2Card contentsOrder type /table label(or "Takeaway"; merged tables shown as a combined "A +B"label), served-by user, thedisplay order number, elapsed time sincecreation, order-level comment, and each lineitem withquantity, per-item comment, and course labelwhenthe course's"indicate" flag isset. Cancellation cards additionally show the original("old") quantity alongside the effective remaining quantity.Aggregator orders alsoshow aggregator nameand externalID.

### 6.3 Color coding (kind/type-driven)
- New dine-inticket → neutral/white.
- New takeaway ticket → blue.
- Order Modified → orange/amber.- Cancelled orPartially cancelled →red.
- Duplicate → shown with a distinct "duplicate — check with captain" warning.

###6.4 Line-item interaction
Individual items can be toggled struck-through("served/handled") on the card;thisper-item strike state is persisted locallyin the browser (keyed byticket+item) andcleared when the card leaves the screen. Itemsare rendered sorted by courseserving priority.

###6.5 Card actions- Ona prep ticket (New Order / Order Modified / Duplicate)→ **Serve**: calls the serve transition (stamps servedtime +duration, status→ Served), thenremoves the card and clears itslocal strike state.
- Ona cancellation ticket(Cancelled /Partially cancelled) →**Confirm**: calls the verify transition (verified = true +verifier), then removes thecard.

### 6.6Timers,alerts, notifications- Each screen reads a **warning time** threshold andan **audio-alert** toggle +sound filefrom the POS profile.- Elapsed time isdisplayed percard; onceelapsed≥ warning threshold the timeturns red.
- Ifaudio alertis enabled, anew-ticket push plays the configured sound (with aone-time "click to enable audio" prompt tosatisfy browser autoplay rules).
- **Delay notification**: whena*non-cancellation*ticket's elapsed timereaches exactly the warning thresholdandthe ticket is still `Ready For Prepare`, the clientasks the backend to notify.The backend creates a system alert (subject "Order #…Delayed", bodywithtable/type context) forevery userholding anyof the roles listed inthe POS profile's notification-recipient roles.---

## 7.OrdinalOrder Numbering (supporting behavior)

Onorder creation thesystem assigns a human-friendly per-shiftordinal (distinct from the internal document id) shown on tickets andthedisplay:
- Maintained per POS profile againstthe open shift record, with a separate counter forthird-party aggregator orders(aggregator numbers are prefixed withanaggregator marker).- Computed as the currentinvoice's trailing numeric segment minus astored "last invoice beforeshift" baseline;thefirst order of a shift seeds the baseline.A"reset daily"profile flag controls whether the display shows thisordinal or falls back to atrailing slice of the invoice id.

---

##8. Business Rules& Invariants

1. **Ticket naming series is mandatory**on the POS profile;ticket generation errors outwithoutit. The cancellation seriesis alwaysthe baseseries witha fixed cancel prefix.
2. **At least one kitchen station must exist** for thebranch; otherwiseordering is blocked witha setup error.
3.**One ticket per station permutation event.** Itemsarepartitioned by stationownership; a stationwithno matching items gets no ticket.
4. **Tickets are append-only history.** Noedit-in-place exceptthe table reference duringatable move.Every quantity/itemchange spawns a new ticket describing the delta.
5.**Kind is immutable;status is forward-only**toServed.Verification is a one-way false→true for cancellation tickets.
6. **Newvs.Modified isautomatic:** apositive-delta batch toa station that already has an active submitted ticket for theorder is Modified, elseNew Order.
7. **Served stampingis authoritative:** serving recordsboththe served timestamp and computed production duration (minutes sincecreation).
8. **Active-display invariant:** aticket shows on the prep displayiff status=Ready For Prepare AND submitted AND not verified AND created within thelast3 hours AND (stationorder-type filter passes) AND stationmatches the screen.Serving orverifying immediately removes it.
9. **Full cancel isatomic inintent:** creating theCancelled ticket(s) anddocument-cancelling theorder's active prep tickets happen together.
10. **Ticket generation mustnot break ordering:** livegeneration failures are swallowed at the order layer and backstopped by the reconciliation job;thatjob mustbeidempotent (onlycreates tickets when none exist for theorder afteritscreation time).
11. **Cancellation tickets mustreference their originals** sothe kitchen can reconcile what'sbeing pulled.
12. **Course"indicate"andserving priority**govern onlydisplay grouping/sort,not routing.
13. **Takeaway suppression** ata station printer only suppresses printing for takeaway;it neversuppresses genuine dine-in tickets.
14. **Real-time channel is per branch+station**; pushes mustrespect the same order-type filter as the query soa stationneversees out-of-scope orders evenmomentarily.15. **Delay notificationfires onceatthe threshold minute** and only for non-cancellation, still-unprepared tickets.---

## 9.Edge Cases

- **Item inno station's category set**→ operator warned; item isnotrouted toanyticket (silent kitchen miss risk —the warning isthe only signal).
- **Orderwith itemsspanning Nstations** → N tickets;eachstationsees only its slice,eachwith independent timers/status.
- **Quantity reducedbut not tozero** →Partially cancelled ticket shows bothold quantity and remaining (old − cancelled) quantity sothe lineisn't misread asfully pulled.
- **Itemfully removed** → treated as a cancellation delta andincludedin thePartially cancelledticket.- **Same order modified repeatedly**→ astackof NewOrder +Order Modified +cancellation tickets accumulates; the display showseach;onlythe reconciliation "no ticket exists"guard prevents duplicate safety-net tickets.- **Live generation fails,orderleftin draft** → within the1–5-minute windowthescheduled job creates Duplicate tickets +error-log rows; these are visually flagged for manual verification toavoid double-cooking.
- **Tablemoved mid-prep** → active unverified prep tickets relabel tothe new table viain-place update +channel refresh; served/verified tickets are untouched.
- **Merged tables** → rendered as a combined label;cancellation releases the whole merge cluster upstream.
- **Aggregator orders** → separate ordinal counter (prefixed), aggregatorname/idshown on the card;canbe excluded from astation via theorder-type filter.
-**Browser offline**→ cards stall(no pushes); reconnect triggers a full refetch; localstrike marks survive vialocalstorage.
- **Audio blocked by browser** → one-time on-screen prompt; sound starts afterfirstuser click.
- **Tickets older than 3 hours** → naturally ageoffthe active display evenif neverserved (they remain queryable viathe served/other views butleave the liveboard).
- **Cancelled pushrace** → clientdoesa delayed full refreshaftera Cancelled push sothe corresponding now-document-cancelled prep cards alsodisappear.
- **Confirming a cancellation**removes it from the board(verified filter); thereis no "un-confirm".

---## 10. PermissionRequirementsThree functional roles interact with the subsystem,each scoped by user-permission recordsto specific POS profile / branch/ room:- **Manager** —full controlover tickets andstationconfiguration: create/read/write/submit anddelete/cancel tickets, fullCRUD on kitchen stations and error logs, manage printers/menus.Can accessthe display.
- **Cashier** — create/read/write/submit andcancel tickets (placeorders, trigger generation,cancelorders); read stations; read/createerror-log rows. Canoperate the display (serve/confirm).
- **Captain / server** — create/read/write/submit tickets and cancel (order +table service), read stations; **no** billing/payment authority. Canoperate the display.
- **System/admin role** — full unrestricted CRUDforsetup and support.Additional gates:
- The **kitchen display screen itself requires anauthenticated session**; unauthenticated accessshows a "login toaccess" block and redirects tologin (returning tothe station URL).- **Branch/room/profile scoping**: user-permission records restrict whichbranch'stickets, stations, and displays a user maysee; the displayquery is inherently branch-scopedand the clientisstation-scoped.
-**Serve**and **Confirm** actions requireanauthenticated displayuser;Confirm records thatuser asthe verifier.
- **Reprint** is gated by a per-profile enable flag (and requires a reprint format + anassigned printer forthe order type).
- **Delay-notification recipients** are defined by roleonthe POS profile; onlyusers holding those roles receive the alert.

---

## 11. Implementation Notes(neutral)-Treat tickets as **submittable, append-only**records;modelkind andservice-status as separate fields so theyevolve independently.
-Keep **routing (item-category → station) server-side and authoritative**; the displayisa read/actsurface, not therouter.
- Make the **real-time push andthe polling query apply identical filters** (status, submitted, unverified,3-hour window, order-type)to avoid divergence betweentheinitial boardand live updates.
-Ensure the**reconciliation job isidempotent** andtime-boxed (settling window) soit never raceslivegeneration intoduplicates.
-Stamp **timingson theserver** (creation,served,duration) rather than trusting clientclocks; the clientmaydisplayelapsed time but completion metrics shouldbe server-computed.
- Persist **per-item"handled"marks onthe client** only (ephemeral UX aid), whileauthoritative completion is theserver serve transition.

Relevant reference anchors (behavior only): kitchen-ticket controller anditstwochildcollections;thegenerate/display/ validation / notification / order-number / reprint APImodules; the station and station-binding definitions; the displayviewcomponent; and the order-sidelifecycle hooks that invoke generation, table-change, and cancellation.