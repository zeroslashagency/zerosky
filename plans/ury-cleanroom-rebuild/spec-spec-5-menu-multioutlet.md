I havecomplete coverage of themenu/pricing/availabilitysubsystem.I'veverified the menuresolution logic, price-list syncmechanism, variant/addon resolution, courses/servingpriority,disable/specialflags, aggregatorpricing,and permissions.Nowwritingthe clean-room neutral spec.

---

# Functional Specification: Multi-Outlet Menu /Pricing / AvailabilitySubsystem

##1. Purpose

Thissubsystem defines **what apoint-of-sale terminal isallowed to sell,atwhat price, and underwhichconditions**, for a businessthat operates multiple physical outlets undera shared company.It answers threecoupled questions atorder-entry time:

1. **Which setof sellable items shouldthisterminal display rightnow?** (menu selection)
2. **Whatprice applies to each item inthis context?** (pricing)
3. **Isthis item currently orderable, and whatoptional choices attach to it?** (availability, variants, add-ons)

The designgoal is thata single deployment can serve many outlets,each with its own catalog andprices, and thatasingle outlet can further vary itsoffering by**physical area**orby **orderchannel** (dine-in vs. takeaway vs. deliveryvs. third-party aggregator)— all without duplicating itemmasterdata.Items liveoncein a shared catalog;menus are curated,priced overlays on topof that catalog.

##2. Scope

Inscope: menu composition,menu-to-contextresolution, price derivation andsynchronization, itemavailability flags, course grouping andserving order, itemvariants, itemadd-ons, andthe special/priority marking ofitems.Out of scope (referenced onlywherethey interlock): orderlifecycle, kitchen routing, payment, andreporting.

---## 3. DomainEntities andRelationships (conceptsonly)

**Company**— the top-level businessentity. Owns oneor more branches.

**Branch (Outlet)** — aphysical orlogicaloperatinglocation. Everymenu and everyrestaurant profile isanchored to exactly one branch. Thebranch is the primary tenancy boundary:menu resolution alwaysbegins bydetermining thecurrentuser's branch.

**Restaurant Profile** —theper-branch configuration hub for themenu subsystem. Thereis onerestaurant profile per branch. It holds:
- a pointer to a **default menu**(the fallback menu usedwhen no morespecific menu applies),
- a **default serving area**,
- two independent feature toggles: *area-wise menu* and *order-type-wise menu*,- a mapping tableof area→ menu (used onlywhen area-wise menu ison),
- a mappingtable of order-type → menu(used only when order-type-wise menu is on),- defaulttax templateandinvoice-numbering prefixes (adjacent concerns,not menu logic).

**ServingArea (Room)** — asubdivision of a branch (e.g., adining hall, a terrace, an AC vs. non-AC section).Belongs to onebranch. Can be associated with a specific menu viathe restaurant profile's area→menu map.

**Menu** —anamed, branch-scoped collection of sellable items withprices. Amenu:- belongs to onebranch,
- has an **enabled** flag,- owns anordered list of **menu lines**,
- is bound one-to-one to anauto-managed **pricelist** (see §5).

**Menu Line(Menu Item)** — one rowwithina menu representing "this catalog item is soldonthis menu at this price."Carries:areference to the catalog item, a denormalized displayname, a **rate (price)**, a **special/featured** flag, a **disabled** flag, and areference to a**course**.Thesame catalog item mayappear asa menu line on manydifferent menus, eachwithits own rate.

**Catalog Item** — the shared masterrecordfora product (fromthe underlying inventory/accounting system). Holds canonical name, image, stock behavior, and — asextensions forthis subsystem — itsown list of **permitted variants** and **permitted add-ons**(eacha listof referencesto othercatalog items). Acatalog item is onlysellable throughamenu ifitappears as a menu line somewhere.**Course** — a menu-section classification (e.g.,Starters, Mains, Desserts).A course carries aunique **serving-priority** integer and an**indicate-in-kitchen** flag thatgoverns whether the course's priority influences kitchen preparation/serving order. Courses areshared across menus (not branch-scoped).

**Variant** — a relationship,not a standalone entity: a catalog item maydeclare a list of othercatalog items asits variants (e.g., sizeorpreparation alternatives). Atorder time thecustomer picks atmost one variant inplace of the baseitem; the variant's price isreadfrom the menu,not from the baseitem.

**Add-on** — sameshape as a variant butadditive: a catalog itemmay declare a list of catalog items as optional add-ons. Thecustomer mayselect zero or more; each selected add-on becomes itsown priced line onthe order.

**Aggregator Configuration** — per-branch, per-third-party-partner settings thatbind a partner to a dedicated pricelist (and dedicated customer/paymentmode). Aggregatorordering bypasses the menu structure entirely and prices directly from the partner's price list (see§5.4).

###Relationship summary- Company `1—*` Branch- Branch `1—1` Restaurant Profile
- Branch `1—*` Serving Area- Branch `1—*` Menu
-Menu `1—*`Menu Line
- Menu `1—1` Price List (auto-managed)
- Menu Line `*—1` CatalogItem
- Menu Line`*—1` Course- Catalog Item `1—*` Variant reference →Catalog Item
-Catalog Item `1—*` Add-on reference → Catalog Item- Restaurant Profile `1—*` Area→Menu mapping;`1—*` OrderType→Menu mapping
- Branch `1—*` Aggregator Configuration `*—1` Price List

---## 4. MenuResolution State MachineThecentralbehavior is selecting **one**menu for thecurrentordering context.Resolution is a deterministic decision tree evaluated perrequest, keyed on:the caller's branch, an optional**serving area**, an optional **order type**, and whether the caller holds a**billing-capable role**.

###4.1 Inputs- `branch` —derived from the currentuser (mandatory;thetenancy anchor).
- `area`— supplied when the orderis beingtaken againsta specific serving area (thedine-in path).
- `orderType`— supplied fornon-dine-in channels (e.g., phone-in, takeaway, delivery).- `isBillingRole` — true when the currentuser's role is onthe outlet's listof billing-permitted roles.

###4.2 States(resolutionoutcomes)
- **S0— Resolving** (initial)- **S1 —Area menu selected**- **S2 —Order-type menu selected**- **S3 —Default menu selected**
-**S_ERR — Unresolved** (terminal error: no menu couldbe determined)

### 4.3Transitions

```S0──[area provided ]──────────────────────────────────►evaluate AREA branch
S0 ──[ noarea, isBillingRoleAND orderType provided]───► evaluate ORDER-TYPE branchS0 ──[otherwise ]───────────────────────────────────────►S3 (default menu)AREA branch:if restaurant.areaWiseMenu isON:
     look up menu mapped to (restaurant,area)found──► S1
        not found──► fall back to default menu──► S3
  else:──► S3(default menu)

ORDER-TYPE branch:
  if restaurant.orderTypeWiseMenu is ON:
     look up menu mapped to (restaurant, orderType)
        found──► S2not found  ──► fallback to default menu ──►S3
  else:──► S3 (defaultmenu)

Any state S1/S2/S3:if theresolved menu reference is empty/null ──► S_ERR (raise "no activemenu forthis outlet")```

### 4.4Resolution rules andinvariants
-**Area takes precedenceover order type.** Ifanarea is supplied, the order-type branch is never evaluated — anarea contextis treated as dine-in.- **Order-type resolution is gated bybilling role.** Theorder-type branch isonly entered when the caller holds a billing-capable role*and* an ordertype ispresent. A non-billing rolesupplying an order type falls straight throughto the default menu.
-**Every specific branch degrades gracefully to thedefault menu.** Amissing mapping isnever anerror; it silently falls back.Theonly hard error is a completely absent default menu attheend ofthe chain.
- **Resolution is stateless andrecomputed per request.** Nomenu selection is persisted onthe order; thesame inputs alwaysyield the same menu.---

## 5. Pricing### 5.1 Priceauthority
The**menu line's rate is thesingle source of truth** for thesale price of anitem onthat menu. Prices arenot readlivefrom the catalog item atorder time (exceptfor the aggregator path,§5.4).

###5.2 Price defaulting onmenu saveWhen a menu issaved, anymenu line leftwithout a rate isbackfilled fromthe catalog item's **standard rate**. Asaved menu therefore never contains a null-priced line.

###5.3 Price-list synchronization (menu⇄ price list)Each menu is mirrored intoan auto-managed pricelist sothe rest of theordering/invoicing pipeline (which isprice-list driven) sees menu prices withoutknowing aboutmenus. This is a **derived, one-wayprojection** witha strict lifecycle statemachine:

**Price-list projection states permenu:**
- **Absent** — no price list existsfor themenu yet.
- **Synced** — aprice list exists and itsitem prices exactly reflect the menu'scurrent lines.- **Stale** — themenu changed andthe projection hasnot yet been rebuilt.

**Transitions:**
```Absent──[ menu saved]──► createprice list (enabled, selling) ──► SyncedSynced  ──[menu saved ]──► Stale──[rebuild]──► SyncedSynced  ──[ menu deleted ]──►purge all itemprices for thislist──► Absent
```**Rebuild rule (the coreinvariant):** on every menusave, the projection is rebuilt by**deleting all existing item pricesfor the menu's price list andre-inserting onepriceentry per currentmenu line** (item+rate). This makes the pricelist a pure functionof the menu'scurrent lines — no incremental diffing, no orphanedprices. Deleting the menu purges theprojected prices.

**Price-list identity invariant:** eachmenu owns exactly one price list,discoverable by a back-referencefrom the pricelist to itsmenu. The price list is alwayskept **enabled**and flagged for**selling**.### 5.4Aggregator pricing (parallel path)Third-party aggregator orders **do not use menus at all**.Instead:-theaggregator partner is bound (per branch) to a dedicated price list,- the sellable listis read directly from that price list's selling entries,
- eachentry contributes itemcode, name, price,and image,- **catalog items marked disabled are filteredout** oftheaggregator list.

Thismeans aggregator availability is governed by the catalog item's disabled flag and price-list membership, whereas in-housemenu availability is governed by themenu line's disabled flag (§6.1).

### 5.5Variant andadd-on pricing
-A **variant's**price is resolved from **itsownmenu line**, not the base item's line.Selecting a variant replaces the base item's pricewiththe variant's menu price.
-Each **add-on**is priced fromits own menu line and addedas a separate order line.- **Order total contribution** for a configured item = (base-or-variant price + sum ofselected add-on prices)× quantity,with add-ons alsomaterialized as their own lines.Anyvariant oradd-on that cannot be foundin the activemenu contributes aprice of zero (defensive fallback) rather than blocking theorder.

---

## 6. Availability

### 6.1 In-house (menu) availability rules
Anitem is **orderable througha menu** ifand only if allof the following hold:
1. Itexists as a **menu line** on the resolved menu (membership requirement).
2.Its menu line's **disabled**flag is off.Disabled lines are excluded from the returned menu at querytime.
3. The item's containing menu is itself **enabled**.The returned menu issorted by displayname and carries each line's itemreference, translated display name, rate, specialflag, image, coursereference, and translated course label.It also returns themenu's last-modified timestamp soclients can cache anddetect staleness.

###6.2 Variant/add-on membership invariant
Whena catalog item declares variants or add-ons, **every referenced item must itself exist as a menu line**somewhere in the menu structure. Saving a catalog item whose declared variantor add-on is not presentinthe menu is **rejected** with a validation error. This guarantees that anyvariant oradd-on offered atorder time hasa resolvable price and availability status.

### 6.3Stock availability
Itemstock behavior is inherited from the shared catalog (stock-trackedvs. not). Real-timestock/quantity checks are performed downstream atorder placement,not duringmenu display;themenu subsystem does not itself hide itemsforbeingout of stock. (Aggregator and menu lists reflect only thedisabled/membership flags above.)

###6.4 NamedenormalizationBecausemenu lines storea displayname copy, renaming acatalog item **propagates** toeverymenu line referencing it,keeping displayed names consistent across allmenus without manual edits.

---

## 7. Courses, SpecialItems, and Serving Priority

-**Course grouping.** Each menu line maybeassigned a course.Clients use courses to (a) rendera sidebar/sectionnavigation and (b) filter thedisplayed menu by section.
- **Special/featured flag.** Eachmenu line carries a specialflag; clients offer a "featured/priority only" filter thatshows justflagged items, alongside an"allitems" view.
- **Serving priority.** Each coursecarries a **unique**integer serving priority.Uniqueness is an enforced invariant:attempting to assign a priority alreadyheldby another course is **rejected**. Thispriority,combined with thecourse's **indicate-in-kitchen** flag, determines theorder in which itemsare prepared/served downstream. Themenu line inherits itscourse's serving priority and indicate-in-kitchen flagby reference.---## 8. BusinessRules & Invariants (consolidated)

1. **Onerestaurant profile per branch**; menu resolution alwaysstarts byresolving the caller's branch.
2.**Exactly one menu isactiveperordering context**, chosen bythe §4decision tree.3. **Area precedence:** an area context suppresses order-type resolution.
4. **Billing-role gate:** order-type-specific menus are only reachable bybilling-capable roles.5. **Gracefulfallback:** anymissing area/order-type mapping falls back to the default menu;onlya missing default menu is a harderror.
6. **Menu linerate is priceauthority**for in-house sales; unsetrates default to catalog standard rate on save.
7. **Price list=pure projection of menu lines**,rebuilt wholesale on every save,purged on delete,always enabled + selling.8. **Disabledmenu lines are neverreturned**; disabled catalog items are excluded from aggregator lists.
9. **Variant/add-on referentialintegrity:** all declaredvariants/add-ons mustexist as menu lines,or the catalog item save is rejected.
10. **Course serving priority is globally unique.**
11.**Aggregator pricing ismenu-independent**, sourced from a partner-bound price list.12. **Name changes propagate**from catalog item to allreferencing menu lines.13. **Variant selection isexclusive (≤1); add-onselection is inclusive (≥0)**; add-ons become independent order lines.

---## 9. EdgeCases

- **Nodefault menu configured:** resolution reaches the terminal error stateand thecaller is toldto configure an active menu forthe outlet.Noimplicit empty menu is returned.
- **Area-wise toggle on but thespecific area unmapped:** falls backto default menu (notan error).
- **Order-type toggle on but the specific ordertype unmapped:** falls back to default menu.- **Order type supplied by a non-billingrole:** ignored formenu selection; default menu isused.
- **Both areaand order type supplied:**area wins;order typeis notconsulted.
- **Menu line with no rate atsave time:** backfilled from catalog standard rate; ifthecatalog hasno standard rate, the linepersists at zero andshouldbe surfaced forcorrection.
- **Sameitemonmultiple menus atdifferent prices:** valid and expected;price isalwaystaken from the resolved menu'sline.
- **Variantor add-on referenced butabsent from the activemenu atordertime:** priced at zero asa defensive fallback (the §6.2 save-time validation istheprimary guardagainstthis).
- **Catalog item disabled butstillpresentona menu:** stillreturned bythe in-house menu (menu-line disabled flag governsthere), but excluded from aggregator lists. Implementers should decide whether toalso honor the catalog disabled flag in-house;thereference behavior gates in-house solely on the menu-line flag.
- **Duplicate course serving priority:** rejectedat coursesave.
- **Menudeleted whileitspricelist isreferenced elsewhere:** projected item prices are purged;downstream consumers must tolerate thepricelist emptying.
- **Stale clientmenu cache:** clients compare the returned last-modified timestamp todetect andrefresh stale menus.

---

##10. PermissionRequirementsThree functional roles interact with thissubsystem:

- **Manager** — fullcreate/read/update/deleteon menus, courses, serving areas, restaurantprofiles, and menu lines. Configures area-wise /order-type-wise toggles and their mappings.- **Cashier (billing-capable)** —read and limited write on menus and restaurant profiles; **isthe roleclassthat unlocks order-type-basedmenu resolution**(mustbe listed amongthe outlet's billing-permitted roles). Reads courses and areas.
- **Captain (service,non-billing)** — read/select access to menus, courses, areas, and restaurant profiles;**cannot** trigger order-type menu resolution (falls backto default menu)and hasno menu-editing rights beyond viewing.

Additional accessrules:- **Branch scoping viauserpermissions:** a user'saccess to menus,areas, and profiles is restricted to theirpermitted branch(es).Menu resolution is implicitly scoped to thebranch the userbelongs to.
- **Billing-permitted-role list isper-outlet configuration**, not a global role;membership in it is whattheresolverchecks for the order-type branch.
-Menu andmenu-line editing (rates, disabled/specialflags, course assignment)is amanager-level capability; cashiers mayhave constrained write, captains none.---Reference materialexamined (for provenance, not to be reproduced): menu/menu-line/course/area-map/order-type-map/restaurant/areaentity definitions andtheirrole-permission matrices;the menu-resolution andaggregator-itemserverfunctions; themenu save/delete price-list projection logic; the catalog-item variant/add-onvalidation hook; the course serving-priority uniqueness validation; and the client menu-fetch,product-configuration (variant/add-on pricing), and course-filtering behavior.