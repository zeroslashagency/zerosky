I havecomplete coverage ofthe inventory/recipe/BOM subsystem. Here is the clean-room functional specification.

---# Functional Specification—Inventory /Recipe / BOM Stock-Control Subsystem## 1. PurposeThis subsystem connects point-of-sale selling activityto back-office stock accounting sothat arestaurant can:

1. **Deplete raw-ingredient inventory automatically** when finished dishes are sold,rather than tracking sellable dishes asstocked units.
2. **Modeldishes as recipes** —a sold menu item expandsinto its underlying consumable ingredients througha bill-of-materials (recipe) definition, including recipes whoseingredients are themselves sub-recipes (nesting).
3. **Modelcombos/meal-deals** as bundles ofseveralsellable items sold underone lineitem.
4. **Offer per-itemmodifiers and variants**(e.g. "extra cheese", "largesize") thatresolve to realcatalog items sotheircost and stock impact arecaptured.
5. **ComputeCost of Goods Sold (COGS)** foratrading day by valuing every sold line atitsingredient buying cost,correctly unwrapping bundles and recipes,feeding thedaily profit-and-loss report.
6.Bind each kitchen/production areato a specific stock locationsodepletion is drawn from the correct warehouse.

Thesubsystem is athin orchestration layer on top ofa general-purpose ERP stockandmanufacturing engine. Itdoes **not** re-implement stockledgers, valuation, or reservation;it configures andtriggers theunderlying engine and adds restaurant-specific cost roll-up logic.

---## 2. DomainEntities andRelationships (conceptsonly)

**Sellable Item** — a catalog entrythat canappear on amenu and beaddedto anorder. Mayormay not be astocked item initsown right.Sellable items are the joinpoint tothe generalstock/accounting engine.

**MenuItem** — themenu-facing presentation of aSellable Item (displayname, price, coursegrouping, availability flag, "special/priority" flag). Every itemreferenced anywhere inthe subsystem (includingmodifiers andvariants) must correspond to a MenuItem. AMenu Item'sdisplayname mirrors the underlying Sellable Item's name andis kept synchronizedwhen the itemisedited.

**Recipe(Bill of Materials)** — a definition attached to a SellableItem that lists the componentingredients and the quantity of each requiredto produce one (or astated batch quantity of) theitem. A recipe has threelifecycle attributes: *active*, *default*, and *confirmed/submitted*. Only the recipe thatis simultaneously active, default,and confirmed is used forcost and stock expansion. A recipe component may itself be aSellable Item that hasits own recipe →recipes nest recursively.

**Bundle (Product Bundle /combo)** — aSellable Item flagged as a bundle,mapping to a setof component Sellable Itemseachwith a quantity. Selling thebundle sells itscomponents implicitly. Abundle component may itself havea recipe.**Modifier (Add-On)** — anoptional add-on associated with a SellableItem, referencing another Sellable Item(sotheadd-on carries its own price,cost, and stock behavior).

**Variant** — a size/variation optionassociated with a SellableItem, also referencing anotherSellable Item.**Production Unit (Kitchen)** — a physical/logical kitchen area.Bound to exactly one POS profile,andthroughit toexactly one **Stock Location (Warehouse)** andoneBranch. Alsoowns theset of item groups itproduces. Stock depletion for itsoutputis drawn from itsbound warehouse.**Stock Location (Warehouse)** — theinventory bucket thatingredient depletion isdrawn from. ResolvedperPOS profile /productionunit;not chosen per-order.

**Buying Price List** — aper-branch price list holding the purchase/cost rate ofeach ingredient. Sourceof truth for ingredient valuation in COGS.Configured inreportsettings.

**Consumable Material** — a free-text-named consumable (not a catalog item) with a cost-per-unit, whose daily consumptionis entered byhand and booked as a direct expense (distinct from recipe-driven COGS).

**COGS Line** — acomputed per-itemroll-up (item, group, quantity sold, unit buying cost, extended amount) produced for atrading day.

**Order/ POS Invoice** — theselling document.Relevant hereonly becauseit is the eventthat triggers stock depletion andthedatasource for COGS.Itcarries a "affect stock" flag andisbound to a branch andwarehouse.

###Relationship summary- Menu Item →1Sellable Item (presentation of).- Sellable Item→ 0..1 effective Recipe →manyComponents (each →1 SellableItem, recursively).
-Sellable Item (bundle) → manyBundle Components (each → 1 Sellable Item, each possiblywitha Recipe).
-Sellable Item → manyModifiers,many Variants (each →1 Sellable Itemthatmust exist asa Menu Item).- Production Unit →1 POSProfile → 1 Warehouse, 1Branch;Production Unit → many ItemGroups.
- Branch →1 Buying PriceList (viareport settings); Buying Price List → cost rateper Sellable Item.
-Order →manyorderlines (each →1 Sellable Item); Order → 1Branch, 1 Warehouse,"affect stock" flag.

---

## 3.State Machines

### 3.1 Stock-Depletion Lifecycle (perorder)

Thesubsystem does notmaintain its own reservationledger;depletion is delegated to theERP stock engine and iskeyed offthe selling document's lifecycle.

Statesofan order line'sstock effect:
- **Noeffect (draft order):** itemsaddedto anopen/draft order donot yet move stock.- **Depletion pending:** ordermarked toaffect stock (flag setat ordercreation)but not yet finalized.- **Depleted:** onorderfinalization/submission, thestock engine posts anoutwardmovement for thesold quantity, expandedthroughrecipes and bundles,drawn from the order's bound warehouse.
-**Reversed:** ifthe finalized order is cancelled/returned, the stock engine reverses the movement.Transitions:
-`Draft →Depletion pending`: order created with affect-stock flag on. (Every newselling documentinthis subsystem iscreated with thatflag onbydefault.)
- `Depletion pending → Depleted`: ordersubmitted/consolidated.
- `Depleted → Reversed`: order cancelled orreturned.Thereis no partial-reservation or soft-hold state — availability is read-throughtothe livestock engine,not locked atcart time.

### 3.2Recipe Effective-StateSelection

A givenSellable Item may haveseveral recipe records. The subsystem selects atmost one asthe effective recipe usinga three-flag gate:States:*Draft*(not confirmed), *Confirmed-but-inactive*, *Confirmed-active-non-default*, **Effective** (confirmed AND active AND default).Onlythe **Effective** state recipe participates in cost expansion and stock unwrapping. Allother states are ignored. Ifno recipe isEffective foran item, the item is treatedas a directly-costed leaf (itsownbuying price isused) rather than beingexpanded.

### 3.3 COGS / Daily P&L Document Lifecycle

States: **Draft → Saved → Submitted**(with anoptional **Cancelled** viathe ERP engine).

- On **Save**: recompute COGS. Ifany requiredingredient/bundle/recipe-component buying price is missing, attach a human-readable remark listing the unpriced items and warn the user; do not blocksaving.
- On **Submit**: recompute COGS again, thencompute the full daily P&L (gross sales, direct expenses incl. consumables, COGS, gross profit, employee/indirect expenses, net profit).Items with unresolved buying prices are silently excluded from COGSatsubmit time (theyare surfaced onlyin remarks). Submit is blocked by unrelated preconditions (e.g.missing electricity reading, missing attendance/pay data) butis**not** blocked solely by unpriced ingredients.

---

##4. Business Rules andInvariants

**R1 — Dishes are notstocked;ingredients are.** Afinished dish generally is not carried as inventory.Stock is consumed atthe ingredient level viarecipe expansion.Selling onedish decrements eachrecipe component by(component qty × dishes sold÷ recipe batch quantity).

**R2— Effective-recipe gate.**Exactly therecipe that is active, default, and confirmed is authoritative.Ambiguity is resolved by theseflags,neverby picking arbitrarily.

**R3 — Recursive expansion withbatch normalization.** Whenexpanding a recipe,each component thatitself has aneffective recipe is expanded recursively; the resulting cost is divided by thatrecipe's stated batch quantity so cost is alwaysexpressed per singleoutputunit. (Referencebehavior resolves atleast two levels of nesting:arecipe's componentmaybea sub-recipe.)

**R4 —Bundle expansion.** A bundle'scost is the sum overits components of (component cost ×component qty),where each component'scost is itsown recipe-expanded cost ifit has aneffective recipe, otherwise its buying-pricerate. Bundles arenevervalued byasingletop-level buying price.

**R5 — Three-waysold-item classification forCOGS.** Every sold line is classified intoexactly one of:1. **Plain item** — nobundle, no effective recipe → valued at its ownbuying price.
   2.**Recipe item** —has aneffective recipe, isnot a bundle → valued byrecursive recipe expansion.3. **Bundle item** — is a bundle →valued by bundle expansion (per R4).
   These threeclasses are mutually exclusive and collectively exhaustive.**R6 — Buying-price sourcing.**Ingredient/leaf valuation alwayscomes from the branch's configured buying price list. A leaf with no entry in that listis "unpriced."

**R7 — Unpriced-itemhandling.** Unpriced leaves (whether top-level items, bundle sub-items, or recipe sub-items) are collected,deduplicated,and reported. Onsave they trigger a warning;on submit they are excludedfrom theCOGS total.COGS must never silently substitute a zero or guessed price intothereported unit cost.

**R8— Warehouse binding isfixed perkitchen.** The warehouse used for depletion isderived from the POS profilebound to the production unit andis read-only attheproduction-unit level.Orders inherit theirwarehouse fromthisbinding,notfromoperator choice.

**R9— Menu-membership invariant for modifiers/variants.** Any itemreferenced asa modifier (add-on) or variant ofa Sellable Item mustalreadyexist as a MenuItem. Saving an item whose modifier/variant listreferences anon-menu item mustbe rejected witha clear error naming the offending item.

**R10 — Name synchronization.** When aSellable Item'sdisplay name changes, allMenu Itempresentations ofitareupdated to match,so menu,KDS, and cost reportsstay consistent.

**R11 — COGS window.** Sold lines counted toward aday's COGS are thoseonfinalized selling documents (paid or consolidated) for the branch, within thatday's trading window. Thetrading window may extend pastmidnight bya configurable numberof hours (late-night service);whenconfigured, the window is [dayStart+offset, nextDayStart+offset]rather than acalendar day.

**R12 — Consumable materials are aseparate cost stream.** Hand-entered consumablematerials (withcost-per-unit andunits-consumed) are booked as direct expenses,separate from recipe-drivenCOGS. Their consumed units must be strictly positive.

**R13 — Quantities.** Recipe batch quantitymust be non-zero (itis a divisor). Componentandsold quantities arenon-negative. Consumedmaterialunits must be > 0.**R14 — Availability is read-through,not reserved.** Thecart/orderflow reflects current stock byquerying the live stock engine;it does not placeholds. Twoconcurrent orders canboth see the same availability.---

## 5.Edge Cases

1. **Itemwith no recipe andno buying price**— appears in theunpriced list; excludedfrom COGS totalbut still counted in saleselsewhere.Reportmust flag it.
2. **Bundle whose sub-item has an effective recipe** — sub-itemmustbe recipe-expanded, notvalued at a(possibly absent) direct price.
3. **Deeply nested recipes**— expansion must normalize byeachlevel's batch quantity;acomponentappearing atmultiple depths must notbe double-counted in the *unpriced* list (dedup),thoughits cost legitimately contributes onceper occurrence.
4. **Recipe exists but is inactive /non-default / unconfirmed** — treated as ifno recipe:item valued asa plain leaf. Do notexpand anon-effective recipe.5. **Same unpriced ingredient acrossmanydishes** — reported once (deduplicated), not onceper parent.6. **Late-nighttrading window** — asale posted at 01:30 belongs to the prior trading day when apositive hour-offset is configured; COGS andsales windows must agree.
7. **Zero netsales for theday** — allpercentage-of-sales figures mustresolve to zero rather than divide-by-zero.
8. **Ordercancelled/returned afterfinalization** — stock reversal must occur; thecancelled quantity mustdrop out of COGS (onlypaid/consolidated docs count).
9. **Modifier/variant pointing ata delisted item** — savemust fail witha naming error (R9), preventing anuntracked cost path.
10. **Concurrent depletion** — becauseavailability is read-through (R14), stock can go negative iftheengine permits;the subsystem relies on the engine'snegative-stock policy rather than pre-locking.
11. **Missing buying price listfor the branch** — everyleaf becomes unpriced; COGS collapses to (near) zero with a fullremark list. Treat as a configuration error, not a crash.
12. **Recipe batchquantity of zero** —mustbe prevented atrecipe definition;otherwise expansion divides by zero.13. **Bundle with a mix of priced and unpriced components**— the bundle contributes thepriced portion ofitscost and adds the unpriced components tothe remark list; itisnot dropped entirely ifatleast partis priced.

---

##6. PermissionRequirementsThree functional roles interact with this subsystem,layered ondocument-level (read/write/create/submit/cancel) permissions andscoped by user-to-branch and user-to-profile assignment:

-**Manager** — full control: define/maintain recipes, bundles, modifiers, variants, production-unit↔warehouse bindings, report settings (buying price list, consumables, expense tables), and create/submit thedaily COGS/P&L document. Read/write/create/submit/cancelon the underlying stock,manufacturing (BOM), material-request, production-plan, and stock-entry documents.
- **Cashier**— operationalselling role.Triggers stock depletionindirectly by finalizing orders.Read/select accessto production-unit configuration;no authority to edit recipes,bundles, warehouse bindings, ortheCOGS/P&L document.
- **Captain/Server** — order-taking and service only. Sameread-through relationship to availability as cashier; no billing, no stock-configuration, no COGS authority.

Additional scoping rules:
-Access to abranch's data(including its warehouse, buying price list, and productionunits) is gated by the user's branch assignment.
- Accessto stock andmanufacturing back-office documents (recipes/BOMs, stock entries, materialrequests, production plans) isgranted to theManager tier and to system administrators; operational roles getread/select atmost.
- TheCOGS/P&L documentis authoredandsubmitted onlyby the Manager tier;verificationof itsfigures should occur in a separate reviewpass, not self-approvedby the sameactor inthe same action.

---

## 7.Implementation Notes foraClean Build

-Treat the stockledger,valuation, reservation, and BOM explosion as provided by anunderlying stock/manufacturing engine.Thissubsystem'sowncodeis: (a) setting the"affect stock" flagand warehouse onselling documents, (b) binding kitchens to warehouses, (c) validating modifier/variant menu membership, (d) synchronizing displaynames, and (e) the recursive cost roll-up that classifies sold lines andvaluesthemagainst the buying price list.- The cost roll-up is the onlynon-trivial algorithmtoreproduce: three-bucket classification (R5), recursive recipe valuation with batch normalization (R3), bundle valuation (R4), and unpriced-itemcollection withdedup and remark reporting (R7).- Availability must be read-through (R14); do not build a reservation tableunless youare deliberately changing thisbehavior.

Reference materialexamined (behavior only):`_reference-study/ury/FEATURES.md`(inventory +COGS narrative), the daily-P&L controller'sCOGS routine anditsrecursive BOM/bundle valuation,the ordercontroller's stock-flag/warehouse handling, the production-unit anditem-hook definitions, andthe materials/COGS/menu-item entity shapes. Nosource, structure, or identifiers were copied; alldescriptions are neutral restatements ofobserved behavior.