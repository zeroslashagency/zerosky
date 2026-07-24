I havecomplete coverage.Writing the spec now.

---# Functional Specification —ShiftClose & Cash ReconciliationSubsystem

## 1. Purpose

This subsystem governs the lifecycle of a cashier's workingsession(a "shift") ata point-of-sale outlet:opening ashift with declared starting cash floats, tracking all sales transactions attributed to that cashier during the shift, andclosing the shift by counting the physical cash/payment drawerand reconciling it against whatthe system expects. It produces anauditable per-cashier andper-dayrecord of expected vs. counted amounts per payment method, surfacing any surplus or shortfall.

Itsupports two operating models:- **Single-cashier outlets**— one workingsession per outlet perday,opened and closed by oneoperator.
- **Multi-cashier outlets**— onedesignated **main cashier** plus oneor more **sub-cashiers**working concurrently under thesame outlet profile.Each sub-cashier reconciles onlytheir own transactions ina lightweight closing document; the main cashier performs the authoritative day-end closingthataggregates everyone.

A secondary purpose is to enforce operational hygiene: preventing a newday'swork from starting whilethe prior day remains unreconciled, and preventinga shift from closing while unfinished (draft) sales stillexist.

##2. Domain Entities &Relationships (conceptsonly)

-**Outlet Profile** — the configuration recordfor a physical selling location. Carries the flags that drive thissubsystem: whether multi-cashiermode is enabled, whetherdaily-close enforcement isrequired, thelist of operators permitted to useit, and the set of accepted payment methods. It alsonames whichoperator is the *main cashier* and whichare *sub-cashiers*.
- **Operator (Cashier)** — a userpermitted to transact underanoutlet profile. Eachoperator is optionally scoped to oneor more serviceareas (rooms) within theoutlet.
- **Shift OpeningRecord** — represents one operator starting a workingsession. It captures the operator, the outlet, the servicearea(s)they are responsible for, the opening date/time, andasetof **opening float lines** (one declared starting amount per payment method).It holds a lifecycle status(Open/Closed)and a reference backto whichever closing record eventually closed it. Inmulti-cashier modeit also recordsthe period start timestamp.
- **Opening Float Line** —a child oftheshift opening record: onepayment method plus thecash/float amount presentinthedrawer at open.
- **SalesTransaction (POS Invoice)**— anindividual settled sale attributed to a cashier,carrying agrand total, nettotal, quantity, customer, posting date/time, and aset of **payment lines** (amount per payment method).Eachtransaction belongs to exactly one shift periodbyvirtue of its cashier and itstimestamp falling inside theshift window. Transactions may be inDraft (unfinished),Paid (settled), or Consolidated (rolled upinto adownstream accounting invoice) states.
- **Sub-Cashier Closing Record** — thereconciliation document asinglesub-cashier producesattheend of their session. It links to theirshift opening record and outlet profile, records the reconciliation period (start =shift open time, end = themoment of closing), and contains twochildcollections: the**linked-transactions list** and the **payment-reconciliationlist**. Italso stores rolled-up totals (grand total,net total, totalquantity) and a processingstatus.- **Linked-Transaction Line** — achild of aclosing record: apointer to onesales transaction withits date and amount, forming the audit trail of exactly which sales were included in thisreconciliation.
-**Payment-Reconciliation Line** — achild of a closing record,one per payment method,holding: opening amount (float), expected amount (whatthe system computed shouldbe inthe drawer), closingamount (whatthe operator physically counted), and difference (counted minus expected).
- **Day-End Closing Record(Main Closing)** — the authoritative end-of-day reconciliation performed by the main cashier.It hasits own payment-reconciliation collection. In multi-cashier mode, eachofits reconciliation linesis thesum of the corresponding sub-cashier closinglineplus the main cashier's owncounted amount, re-derived against the expected figure.

**Relationships:**One Outlet Profile hasmany Operators and many Shift Opening Records. OneShift Opening Recordis closed by exactly one closing record (sub-cashier closing inmulti-cashier mode, day-end closing otherwise) and holds a back-reference to it. One closing record aggregates many SalesTransactions (via linked-transaction lines) and produces onereconciliation line per payment method. In multi-cashier mode, oneDay-End ClosingRecord logically consumes manySub-CashierClosing Records forthe same period.

## 3. StateMachines

### 3.1 Shift OpeningRecord

States: `Open` → `Closed`(reversible backto `Open` on cancellation ofthe closing).|From|Event | To |Notes |
|------|-------|-----|------|
| (none) | Operator opens shift, declares floats, submits |`Open` | Becomes theactive session;unlocks selling forthat operator/area. |
| `Open` | Itsclosing record issubmitted | `Closed` | Theclosing record stamps itsown identifier onto the opening record andflips status.|
| `Closed`| Its closing record is cancelled | `Open`| Reverts toopensothe shift can be re-closed.|

Anopening record is only "active" while status=`Open` **and** it is insubmitted (committed) state.

### 3.2 Closing Record(both sub-cashierand day-end)Thereconciliation documentis asubmittable document. Its ownlifecycle status fieldtracks backgroundprocessing,layered on top of the standard draft→submitted→cancelled documentlifecycle.Processing status values: `Draft` → `Queued` → `Submitted` (success) or`Failed`;plus `Cancelled`.

| From | Event| To | Notes ||------|-------|-----|------|
| (new) | Documentcreated,period+cashier chosen | `Draft`| Pulls opening floats and transactions topopulate reconciliation lines. || `Draft` |Operator enters counted amounts andsubmits | `Queued` | Reconciliation processingruns (mayexecute inbackground). |
| `Queued` | Processing succeeds | `Submitted` | Linked opening record flips to `Closed`;acompletion signal is broadcast. || `Queued` | Processing fails| `Failed` | Anerror message is recorded; thedocument offers a **Retry** action thatre-runs processing.|
| `Failed` | Operator resolves cause and retries | `Queued` | Loops back intoprocessing. |
| `Submitted` | Document cancelled | `Cancelled` | Linked opening record reverts to `Open`.|

A real-time completionevent notifies the openformwhenprocessing finishes soitcan refresh and surface any failure message.

##4. Shift OpenFlow (behavioral)1.Operator initiates a shift openfor the outlet.Thesystem pre-fills the operator identity and resolves the outlet profilefromthe operator's branch.
2.The operator's responsible service area(s) areresolved from theiruser-to-branch mapping. In multi-cashier mode, allmapped areas are attached as a multi-area collection; otherwise asingle area is set.
3.Opening float lines are seeded,one per accepted payment method, defaulting to zero;the operator declares actual starting amounts.
4. **Multi-cashier gate:** if the operator opening theshift is *not* the maincashier, the systemverifies that themain cashier alreadyhas an active(open,submitted) shift for thisbranch dated today. If themain cashier'sshift is not yet open, the sub-cashier's openis rejected("MainCashier POS must be open"). Thisenforces open-order: main first, subs after.
5. In multi-cashier mode theperiod start timestamp is stamped to the current time atsave.
6. Onsubmittherecordbecomes `Open`and selling is unlocked for thatoperator andarea(s).

**Day-start gate (independent):** selectionofa table/startof any transaction is blocked entirely if no active shift opening exists for the day.Separately, if theoutlet requires daily close, the systemchecks whether the *previous businessday's* shift remains open (see §6, "dayboundary"); ifso, opening a new sessionis refused untilthe prior day is closed.## 5. Shift Close Flow (behavioral)

### 5.1 Sub-cashier closing (multi-cashier mode)1. Sub-cashier creates a closing record;operator identity and outlet profile auto-fill. Only shift openingrecords that are open, submitted, and owned by thisoperator are selectable.2. Selecting theopening record defines the reconciliation window: period start = the opening record's start;period end = now.3. The systemseeds reconciliationlines from the opening floats(expected initially=opening amount), then pulls every settled,submitted,non-consolidated transaction for this cashier withinthe window.
4. For eachtransaction'spayment lines, the expected amount forthematching payment method is incremented; apayment method notpresentin the floats is added onthefly withzero opening/counted.Change-givenisnetted outof the payment method usedfor changesoexpected reflects truecash retained.
5. Runningtotals (grand total, nettotal, quantity) accumulate, and each includedtransaction is recorded asa linked-transaction line.
6. The operator enters the physically counted **closing amount** per payment method;**difference = closing − expected** is computedlive perline.
7. **Validation beforesave/submit:**
   - NoDraft (unfinished) transactionsmayexist for this cashier atthisbranch — ifany remain, closing is refused ("Submit/Delete Draft Invoices").
   - The **main cashier isforbidden** from creating a sub-cashierclosing ("The MainCashier cannot close aSub POS Closing entry").
   - Period endandposting date/time are stamped to the moment of closing.
8.On submit:status → `Submitted`, the linked opening record is marked `Closed` and back-referencesthisclosing.On cancel: theopening record reverts to `Open`.

### 5.2 Day-endclosing (maincashier)1. Performed by the main cashier only.**Sub-cashiers are forbidden**from creating a day-end closing.2. **Pre-close gate:** beforesaving, the system verifies thatevery sub-cashier underthisoutlet has alreadyclosed their session. If any sub-cashier'sshift isstill openandsubmitted, the day-endcloseis refused ("Sub Cashier POSmust be closed"). This enforces close-order: subs first, main last —the mirror image of theopen-order rule.
3.Expected amounts perpayment method arecomputed from themain cashier's own transactions exactly as in §5.1.
4. **Aggregation:** foreach payment-reconciliation line, thesystem locates the matching sub-cashier closing line(s) for the same period and sets**combined closing amount = sub-cashier counted amount + main cashier's owncounted amount**, thenrecomputes **difference =combined closing − expected**. If no sub-cashier closing recordsexist within the period, the day-end close is refused("No Sub POS Closing entries found").5. Day-closeismandatory toconsider outlet operations complete forthe day.

## 6.Business Rules & Invariants

- **Oneauthoritative closeper shift.** Ashift opening transitions to `Closed` byexactly one closing record andstoresthatreference; cancelling theclosing reopens it.Thereis no partial-closed state.
- **Window ownership.** A transaction isincluded in a closing only if it matches the cashier, issettled andsubmitted, isnot alreadyconsolidated downstream, and itstimestamp falls within[period start, period end].Consolidated transactions are explicitly excluded toavoid double counting.
- **Expected= floats + settled inflows,net of change.** Perpayment method:expected = opening float + sum of thatmethod's payment amounts acrossincludedtransactions, with change-given subtracted from the changepayment method.- **Difference = counted − expected**, computed per payment method.Thisis the surplus/shortfall figure and is stored perreconciliation line.(Thesubsystem recordsthedifference; it does not itself block ona nonzero difference.)- **No opendrafts atclose.** A cashier cannot close while any unfinished (draft) transaction attributed to them exists atthe branch.
- **Open-order invariant (multi-cashier).** Main cashier'sshift must be open before any sub-cashier may open.Enforced at sub-cashier open time.
- **Close-orderinvariant (multi-cashier).** All sub-cashiers must beclosed before the maincashier'sday-end close. Enforced at day-end savetime.
- **Role separation invariant.** Themain cashier may onlyperform day-end closings; sub-cashiersmay only perform sub-cashier closings.Neither may perform the other's closing type.
- **Aggregation completeness.** A day-end closein multi-cashier mode requires at least one matchingsub-cashier closingin the period; otherwiseitcannot proceed.- **Day-boundary rule.** The"business day" for daily-close enforcement starts atafixed early-morning cutoff (e.g.,05:00). Before thecutoff the currentcalendar day is treated as stillbelonging to the prior businessday; after it, theprior businessday is the daybefore.Daily-close enforcement checks whether thatprior businessday's shift is stillopen and, if so, blocks starting newwork.
- **Single-cashier simplification.** Whenmulti-cashier mode isoff, all the multi-cashier gates (open-order, close-order, roleseparation, aggregation)are inert; a single operator opens and closes normally.
- **Idempotentre-derivation.** Loading/saving aclosing re-pulls transactions and recomputes expected/difference fromscratch rather than incrementally trusting prior values, so re-opening adraft yields consistent figures.
- **Audittrail.** Every includedtransaction is retained as a linked-transaction line onthe closing,androlled-up grand/net/quantity totals are stored,so the closing is self-describing withoutre-querying.## 7. EdgeCases

- **Newpayment method mid-shift.** A payment method usedina transaction butabsent from the declared opening floats is auto-added to the reconciliation with zero opening andzero counted; itsexpected stillaccrues.Theoperator must thencount it.
- **Change-given.** Whena transaction returns change onagivenpayment method, that changeis subtracted from the method's expected inflow so thedrawer expectation is net.- **Zero transactions inwindow.** A closing with no settled sales still reconciles pure floats (expected = opening amount per method).
-**Missing sub-cashier closings at day-end.** Day-end close isblocked with a clear messagerather than silently reconciling onlythe main cashier.
-**Sub-cashieropens before main.**Blocked at open with"Main Cashier POSmust be open."- **Main tries to close beforesubs.** Blocked atday-end savewith "Sub Cashier POS must be closed."- **Wrong rolecloseswrong type.** Main creating a sub-closing,or sub creating a day-end closing, isrejected.- **Draft invoices linger atclose.** Blocked untiltheyare submitted or deleted.
- **Prior daynot closed.** Withdaily-close enforcementon, starting anew day is blocked;the day-boundary cutoff governs whichdaycounts as "prior."- **Background processing failure.** Ifreconciliation processing fails,the closing lands in `Failed` withastored error message and a **Retry** affordance; a real-time signal refreshes the form toshowthe failure.
- **Closing cancellation.**Cancelling a submitted closing reopens the linked shift so itcan be re-closed,preventing anorphaned closed shift.
- **Concurrent sub-cashiers,same area.** Area-to-shift resolution picks the active openshift for the branch+area; eachcashier reconciles strictly their own attributed transactions,so concurrencydoesnot cross-contaminate totals.

## 8.Permission RequirementsThree functional roles, with a fourth system-administrator role forsetup:

- **Manager** — full controlover shift-open andclosing records: read, create, write, submit, andcancel, includingreadaccessto permission-restricted reconciliation fields (expected amount, difference). Managers are the only operationalrole that can cancel a submitted closing (which reopens the shift).
-**Cashier** — mayread, create, write, andsubmit closing records (i.e., perform their own reconciliation)but **cannot cancel** them. Within multi-cashier mode, the main-vs-sub distinction furtherrestricts *which* closing type eachcashier may create(enforced bybusiness rules in§5–§6, not just rolegrants).
- **Captain (service-only)** — read/select visibility intoclosingsbutno create/write/submit;captains handle orders andtableservice and are excluded from cashhandling andreconciliation.
- **System Administrator** — fullrights forconfiguration and correction.

**Field-level protection:**thereconciliation figures thatreveal expected drawer contents and the surplus/shortfall (expected amount, difference) are guarded atanelevated permission level,readable by the manager role,soordinary operators countblind againstthe system's expectation rather than seeing the target.**Scoperestriction:** operators are constrained byuser-levelrecordpermissions to theirassigned outlet profile andbranch (and service area), soa cashier canonly open/close and reconcile shifts within outlets they are provisioned for.

---**Sourceanchors examined (reference only, not reproduced):** thesub-cashier closing document controller and its formscript; the sub-cashier closing-payment and linked-invoice child definitions; the shift-openandday-end-close serverhooks; andthe outlet-profile /opening /daily-close validation helpers in thePOS API layer. Absolute paths: `/Users/xoxo/Documents/resreah/billing/_reference-study/ury/ury/ury/doctype/sub_pos_closing/`, `/Users/xoxo/Documents/resreah/billing/_reference-study/ury/ury/ury/hooks/ury_pos_closing_entry.py`, `/Users/xoxo/Documents/resreah/billing/_reference-study/ury/ury/ury/hooks/ury_pos_opening_entry.py`, `/Users/xoxo/Documents/resreah/billing/_reference-study/ury/ury/ury_pos/api.py`.