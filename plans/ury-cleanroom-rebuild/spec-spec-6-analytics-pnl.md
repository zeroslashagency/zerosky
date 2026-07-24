I have comprehensive coverage ofthe analytics subsystem. Writing the neutral clean-room spec now.---

# Functional Specification: Analytics &ReportsSubsystem (DailyP&L andItem Trends)

##1. PurposeTheAnalytics & Reports subsystem turns settled point-of-sale transactionsinto twofamiliesof business intelligence:

1. **DailyProfit & Loss (P&L)** — a per-branch, per-day financial statement that amanager reviews and formally finalizes. It reconciles theday's sales against cost of goods sold, direct expenses, employee costs, and indirect/overhead expenses to derive gross profit and netprofit,each alsoexpressed as a percentageof net sales.
2.**Operational &sales reports** — aset of read-only,parameterized reports (itemtrends, time-of-day sales, day/monthrollups, averagebill value, cancellations, customer analysis, and per-employee sales)that readdirectly from settled transactions withoutany finalization step.

The subsystem is strictly downstream of billing:it nevercreates or mutates orders or invoices. It only reads settled transaction dataand configuration,and (for P&L only) produces itsown finalized statement document.

##2. Domain Entities andRelationships (conceptsonly)

-**SettledTransaction** — a completed sale.Each carries a branch, a posting date, a posting time,anorder type(dine-in /takeaway / delivery /aggregator), anoperator/waiter reference, a customer reference, andmonetary totals (item subtotal, tax, grand total, rounded total,amount actually paid, changegiven).Onlytransactions in a settled lifecycle state("paid" or"consolidated") thatare validly submitted areever counted. Thisentity is owned by the billing subsystem;analytics treats it as read-only.- **Transaction Line** — anindividual item ona settled transaction,withitem reference, quantity, andline amount. Usedforitem-level trendandcost analysis.
- **Item/ItemGroup**— the catalog concepts aline references. ItemGroup provides the category dimension used togroup itemtrendreports.
- **Recipe (Bill of Materials)**— anoptional definition mapping a sellable item toconstituent sub-items andtheir quantities. Recipes maynest (a sub-item mayitself have a recipe).Used to compute cost for manufactured items.
- **Product Bundle** —anoptional definition mapping asellable "combo" item to aset of componentitems andquantities. Abundle component may itself be recipe-backed.Used to compute cost forcombo items.
- **BuyingPrice Entry** — a cost (purchase) price for anitem under a designated buying price list. Cost calculations resolve everyitem (directly,or through recipe/bundle expansion) to theseentries.
- **ReportSettings (per branch)** — the configurationrecordthat governs bothP&L computation and the day-boundary behavior of reports. Oneperbranch. Contains: thebuying price list;a per-unit electricity charge rate; a depreciation amount; an"extended hours" flag plus an hour-count thatdefines acustom business-day boundary; and severalexpense tables (seebelow).
- **Expenseconfiguration tables** (childrenof Report Settings):- *Direct fixed expenses* — namedfixed amounts treated as direct costs.
  - *Indirect fixed expenses* — named fixed amounts treated as daily overhead.
  -*Monthly fixedexpenses* — named amounts specified permonth, amortized toa daily figure.
  - *Percentage expenses* — namedexpenses computed as a percentage of eithergross sales or net sales.- *Employee cost expenses* — named fixed amounts added to employee cost.
  - *Consumables (burning materials)* — namedmaterials each with a cost-per-unit, used toseed the P&L'sdaily material-consumption entry.
- **DailyP&L Statement** —thefinalized outputdocument,oneper (branch,date). Holds computed summary figures,theirpercentages, and detail breakuptables (direct expenses, employee costs, indirect expenses, cost-of-goods lines). It is asubmittable document(draft →submitted →optionally cancelled/amended).- **P&L childrecords**(owned by the statement):*materials-consumed lines* (material,cost-per-unit,units consumed, amount),*cost-of-goodslines* (item, group,qty, buying price, amount), and*expense breakup lines* (label, amount, percent).
- **Employee /Attendance** — HR records readtocompute employee cost:each employee has abranch,a payment type ("Salary" monthly or "DailyWage"), and a paymentamount; attendance records mark presence perday per employee witha status (present /half-day).**Relationships:**ABranch has exactly one Report Settings. ADaily P&L Statement belongs to one Branch andone date andis derived from allsettled transactions for that branch/dayplus thatbranch's Report Settingsandtheday's attendance.Transaction Lines roll up to Items, which resolve throughRecipesand Bundles to Buying Price Entries.Reports are stateless viewsover settled transactions filtered by branch and date range.

## 3. StateMachine(s)

### 3.1 Daily P&LStatement lifecycle

The onlystateful entity in this subsystem. It follows a draft → finalized documentmodelwithamendment.

States:
-**Draft** — beingprepared; editable inputs (date, branch, electricity readings, materialunitsconsumed,ad-hoc "other expenses"). Cost-of-goods is recomputed on every save sothepreparer can preview it.Summary financialsare notyet meaningful/visible.
- **Submitted (Finalized)** — allcomputed figures are locked andread-only;breakup tables and therendered statement are populated andvisible. Thisis the authoritative recordfor the day.
- **Cancelled** — afinalized statement that has beenvoided.- **Amended**— a newdraft created from a cancelledstatement, linked backto its predecessor, tocorrect andre-finalize.Transitions:| From | Event | To |Effect /guard|
|---|---|---|---|| (none) | Create for(branch, date) | Draft | Branch and date becomefixed onceset. Selecting thebranch pre-loads the material-consumption rows from thatbranch's configured consumables; ifthe branch has no ReportSettings, creation is blocked withanerror. |
| Draft | Save | Draft| Recompute cost-of-goods preview. If anysold item cannot be costed, recorda warning noteand prompt the preparer,but allow the save.Clear any stale warning note on loadofa fresh draft. || Draft | Submit |Submitted | Runfull computation andallguards (Section 5). Allsummary andbreakup fields are computed and frozen.Fails (staysDraft) if any guard isviolated. |
| Submitted | Cancel |Cancelled | Standard void. |
| Cancelled | Amend | Draft (amended) | Newdraft referencesthe cancelled original. |Editable-inputrules bystate:date,branch, electricity opening/closing, materialunits-consumed, and ad-hoc other-expensesare editable only whileDraft; onSubmit theybecome read-only.Material-consumption rows cannot be added or deletedbyhand — theset ofmaterials is fixed byconfiguration — onlythe units-consumed value perrow is entered.

### 3.2ReportsReports have **no state machine**.Each reportis a pure, repeatable query parameterized by filters (branch and,perreport, a date ordaterange andsometimes an employee orcustomer). They readonly settled transactions and never persist anything.

## 4.BehaviorDetail

### 4.1Thebusiness-day boundary (shared rule)

BothP&L and every date-scoped report resolve "which dayatransaction belongs to"throughthe branch's Report Settings:- If the branch defines anextended-hours cutoff (hour-count > 0), abusinessday runs from thathour onthe calendar date until the samehour on the followingcalendar date (e.g., a cutoff of 5 means05:00 todaythrough05:00 tomorrow).Atransaction is attributed toabusinessday by comparing its combined posting date+time against thiswindow.This lets late-night tradepastmidnight count toward the prior business day.
- If nocutoff is configured (absent or zero), orif noReport Settings exist forthe branch, thetransaction is attributed byitsplain posting date.

This rule must be applied identically across P&L cost/sales aggregation and alldate-filtered reports sofigures reconcile.

### 4.2 Daily P&L computation (on Submit)

Computed in this order:1. **Cost of Goods Sold (COGS).** Aggregate sold quantities per item acrosstheday's settled transactions,partitioned into three cases:
   - *Plainitems* (no recipe,no bundle): cost =buying price ×qty.
   - *Recipe-backed items*: cost = fully-expanded recipecost ×qty. Recipeexpansion isrecursive —a sub-item thatitself has a recipe isexpanded; the per-unit cost of a recipeis itssummed componentcost divided by the recipe's outputquantity.
   - *Bundle items*: cost = sum over components of (component cost × componentqty), where arecipe-backed component isexpanded asabove anda plain component uses its buying price.Eachcosted itemproduces acost-of-goods breakup line; COGS istheirsum.Any item (or sub-item) withno buying price is skipped fromcost and itsname is collected intoa warning note grouped by cause (plain items/bundle sub-items / recipe sub-items).2. **Gross sales&derived sales figures.** Fromthe day's settled transactions: gross sales = sumof grand totals; tax= sum of (grand total− itemsubtotal); discounts &round-offs = sum of round-off plus cash-discount components(rounded total minus paid plus change); net sales = gross sales − discounts/round-offs − tax.If there are zero invoices,allsalesfigures are zero.
3. **Direct expenses.** Sum of each material's(unitsconsumed × cost-per-unit) plus allconfigured direct fixed expenses.Each becomes a direct-expensebreakup line.
4.**Gross profit** =net sales − direct expenses − COGS.
5. **Employee cost.** For daily-wage employees withattendance thatday: full amount for "present", half for"half-day". For monthly-salary employees ofthe branch: amount divided by the number of daysin thatmonth. Plus allconfigured employee-cost expenses. Sum becomes totalemployee cost; each elementis a breakup line.6. **Indirect expenses.** Totalemployee cost +electricity (consumption reading × per-unit rate) + configured indirect fixed expenses + monthly fixed expenses amortized perday + percentage expenses(percent applied to gross or net salespereachrow's basis) +ad-hoc other-expenses + depreciation. Each becomes anindirect-expense breakup line.7. **Net profit**= gross profit − totalindirect expenses.8. **Percentages.** Every summary figure is alsoexpressed as a percentageof net sales (net salesitself =100%). If net salesis zero, all percentagesare zero.

**Preparer conveniences:**When anew date is chosen, the electricity opening reading is pre-filled from the prior day's closing reading forthesame branch (best-effort;silent if nonefound). Each material row's amount auto-updates as units-consumed is entered.###4.3 Reports catalog

Allreports are branch-scoped, readonlysettled transactions, apply the business-day boundary, and are read-only views.- **Today's Sales** — single-rowsummary for the current business day:invoice count, itemtotal, taxes, grand total, round-off, cash discounts. Filter: branch.- **Daywise Sales** — onerow per day acrossa date range withthe same sales columns. Everydayin the range appears evenwithzero sales (dense dateseries).Filter: branch, start/end date.
- **Daywise Invoices** —onerowper individual invoice in arange: date, formatted time, invoice reference, item total,taxes, grand total,round-off, rounded total, received amount (receivedtreated as zero for aggregator-groupcustomers). Filter: branch, start/end date.- **Month WiseSales** — monthly rollup(year,month name, item total, taxes,grand total) over a trailing multi-month window. Filter: branch.
- **Average Bill Value** —perday ina range: invoice count,total sales, andaverage bill value (total÷ count). Filter: branch, start/end date.
- **ItemWise Sales (item trends)** — per itemacrossa range: item group, item name, totalquantity, total amount;grouped by item andordered by group. Thisis the core"item trends" report. Filter: branch,start/end date.
- **Employee Item Wise Sales** — sameshape as item-wise butscoped to one operator/waiter.Filter: branch, employee, start/end date.- **Employee Sales** — per employee per day:invoice count andsales amount. Filter: branch, start/end date.
- **Service Wise Sales** — per dayperorder type: grand total.Filter: branch, start/enddate.
- **TimeWise Sales** —theday splitinto twelve fixed two-hour buckets;each bucket shows sales total andbill count,with empty buckets shown as zero. Filter: branch, single date.- **CancelledInvoices** — per cancelled invoice in arange: date, formatted time, invoice reference, whocancelled,cancellation reason.Filter: branch, start/end date.
- **Customer Data** — per invoice in a range: date,invoice reference, customername, mobile number, total;optionally narrowed to one customer.Filter: branch, start/end date, customer.
- **Daywise Customer Details** — distinct customers(id, name, mobile) transacting in a range. Filter: branch, start/enddate.
- **Repeated Customers** — per day: total customers, new customers, repeatedcustomers (total − new), andrepeat percentage. Filter: branch, start/end date.##5. Business Rules& Invariants

1. **Onlysettled transactions count.** Every figure (P&L and reports) includes only validly-submitted transactions in"paid" or "consolidated" state. Drafts, unbilled, returned, and cancelled transactions are excluded from sales/COGS aggregation.(Cancelled invoices appear only in the dedicatedCancelled Invoicesreport.)
2. **P&L is unique per (branch, date)** and branch/date are immutable onceset.
3. **Abranch must haveReport Settings** beforea P&L can be created forit; without it,creation is blocked.4. **Electricityreading must be positive**: closing minus opening must be greater than zero,elseSubmit is blocked.5. **Units consumed must be positive**for every material row, else Submit is blocked.
6. **Attendance must exist**: ifnopresent/half-day attendance ismarked for the branch onthat date, Submit is blocked.7. **Employee payment configuration must be complete**:any employee with attendance thatday but missing payment type oramount blocks Submit,naming the offending employees.
8. **Uncosted items are excluded,not fatal**: anitem lacking a buying price is dropped from COGS and surfaced in a warning note; the preparer isadvised to setprices and re-finalize foraccuracy, but mayproceed.
9. **Net-sales-zero safety**: when net sales is zero, all percentagemetrics are zero (no division by zero).
10. **Recipe costis normalized byoutput quantity** and expansion is fully recursive; bundles expand onelevelintocomponents, each of which may itselfbe recipe-expanded.
11. **Monthly expenses andmonthly salaries are amortized**by the actual number of days inthe P&L's month.
12.**Finalized figures areimmutable**: afterSubmit,all computed andbreakup fields are read-only; corrections require cancel-and-amend.
13.**Reports are side-effect free**and reproducible:same filters yield sameoutput;theynever writedata.
14. **Densedateseries**: range reports emit arow for every datein rangeregardless of activity,so gaps are visible aszeros.

## 6. Edge Cases- **Zero-invoice day**: P&L still finalizes (subject to other guards) with allsales figures and percentages zero; expenses maystill produce anet loss.
- **Midnight-spanning trade**: withan extended-hours cutoff, post-midnight transactions attachto the prior business day; thesame cutoff must be honored byreports ortotals will disagree with the P&L.- **Missing buyingprices**across plain items, bundle sub-items, and recipesub-items arecollected separately bycause and reported together.- **Deeply nested recipes**: recursion must terminate correctly andnormalize each level byits output quantity; a mis-setrecipe withnopriced leaves contributes zero andlists itsunpriced leaves.- **Half-day attendance**contributes halfadaily wage.- **Monthly-salaried staff** are alwaysincludedfor their branch regardless ofthatday's attendance (theircost is adaily fraction of monthly pay).
- **Aggregator customers**: inthe per-invoice report their"received amount" is forced to zero (payment settled off-platform);ensure this special-casing does not leak into othertotals.
- **Percentage expense basis**: eachpercentage-expense row independently targets gross or net sales;mixing bases inone statement is expected.
- **Electricity opening pre-fill absent**when noprior-day statement exists —the fieldis simply left blank formanual entry.
- **Stale warning note**: a warning left ona draft froma prior savemust be cleared whena clean draft is reopened soit doesn't mislead.- **Amendment**: a corrected statement is a fresh draftlinked to the cancelledoriginal;theoriginal remains asa voided audit record.

## 7.Permission Requirements- **Daily P&LStatement**: full lifecycle (create, read, write, submit,cancel, amend,and print/export/share) is granted to the **manager** role (and toa system-administrator role). Nolower operationalrole (cashier, captain/waiter) maycreate orfinalize P&L.Becausefinalization is asubmitaction, onlyroles with submit rights canfinalize.- **Report Settings**: create/read/write restricted to the **manager**role (and system administrator). Thisis sensitive configuration (buying pricelist, expense schedules, day-boundary)and mustnot be editable by operationalstaff.
- **Reports**: readable by the**manager** role and by finance/accountsroles (anaccounts-manager and anaccounts-user role).Reports expose aggregated financialsand customer PII (names,mobile numbers), sothey are scoped to management/finance,not floor staff.
- **Record scoping**: accessshouldbe constrained to the user's permitted branch(es); ausermustonly see analytics for branches they are authorized on.Branch isafilter on every report andtheanchor ofevery P&L.- **PII handling**: customer-facing reports returnnamesand mobile numbers;treat theseas sensitive and gate behind the finance/management roles above.

---Sourceanchors examined (reference-only): `_reference-study/ury/ury/ury/doctype/{ury_daily_p_and_l, ury_report_settings, ury_cost_of_goods,ury_fixed_expenses, ury_variable_expenses, ury_materials, ury_p_and_l_breakup,ury_p_and_l_materials}`and the 14 reportdefinitions under`_reference-study/ury/ury/ury/report/`. The spec above isaneutral behavioral description; no sourcecode, structure, or identifiers were copied.