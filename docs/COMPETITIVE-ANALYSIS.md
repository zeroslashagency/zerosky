# Zerosky vs Petpooja — feature comparison

Researched 2026-07-27. Petpooja data was scraped from live sources; Zerosky data
was read from this codebase with file:line evidence. Confidence is labelled
throughout because the two sides are not equally verifiable.

## How to read the evidence

| Source | What it proves | Trust |
| --- | --- | --- |
| petpooja.com marketing | that a feature is *sold* | Low on detail, may be inflated |
| Play Store / App Store listings | that an app exists and what it claims | Medium |
| G2 (289 reviews), Capterra (37), Software Suggest, TechJockey | what users actually experience | High for pain points |
| App Store / Play Store / website screenshots, opened and read as images | what their screens actually contain | High for layout, dated (some captures are old) |
| This codebase | exactly what we have | High |

**Important gap:** Petpooja has no public help centre, knowledge base, or user
manual. `support.petpooja.com` does not resolve. So we know *which modules they
sell*, but not *how their settings screens are actually organised*. Anyone who
tells you otherwise is guessing. A sales demo is the only way to close that gap.

Petpooja's own numbers also contradict each other, which is worth knowing before
treating any of them as a target: 100,000+ restaurants on the home page vs
75,000+ on feature pages; "80+ reports" on pricing vs "100+" on the analytics
page vs "50+ free reports" elsewhere.

---

## 1. The honest headline

Petpooja sells **12 modules across 7 separate apps**. We have **one web app with
13 screens**. The gap is not polish, it is scope.

But their weakness is specific and documented, and it is not features:

> "User interface feels outdated in some areas. It works fine, but visually it
> could be more modern and clean." — G2 review

> "UI and UX Can be more simpler. Urban Piper is better in this." — Capterra

> "Slow performance issues with delays in order updates and notifications" —
> **14 separate mentions on G2**

> "order taking screen is not User friendly" — Capterra, review by a co-founder

> "Features feel overwhelming at first. When you open the system the first time,
> there are many options, which can be confusing" — **6 mentions on G2**

They have no dark mode and no theme customisation of any kind. Their brand is
red-on-white and that is what every user gets.

So: they are wide and dated. We are narrow and modern. Our appearance system
with 8 palettes and dark mode is a real differentiator today, and our 432 tests
plus a Playwright suite is engineering rigour they show no public evidence of.
Neither of those wins a deal on their own.

---

## 2. Module-by-module comparison

Legend: **Full** = works end to end · **Partial** = exists but incomplete ·
**Backend only** = API works, no UI · **Schema only** = database supports it,
no code · **Missing** = nothing exists

### Billing and orders

| Capability | Petpooja | Zerosky | Evidence |
| --- | --- | --- | --- |
| Take order, generate KOT, print, settle | Yes | **Full** | verified end to end in browser |
| Order types: dine-in / takeaway / delivery | Yes, all in one screen | **Schema only** — enum has all 4, UI only ever sends DINE_IN | `schema.prisma:36-40` |
| Multi-tender split payment | Yes | **Full** | `payment.record`, settles on full capture |
| Split a bill between guests | Yes | **Missing** — a split engine exists in `packages/payments/src/multi-tender.ts` but is not wired | |
| Merge bills / merge tables | Yes | **Missing** | |
| Transfer table / transfer captain | Yes | **Missing** — schema supports it, no procedure | |
| Discounts | Yes, with rules | **Schema only** — `Order.discountTotal` exists and reports read it, but **no procedure ever writes it** | `reports.ts:200` reads; zero writes |
| Service charge | Yes | **Missing** — deliberately removed after it caused a bill/charge mismatch | |
| Coupons and offers | Yes | **Missing** | |
| NC / complimentary bills | Yes | **Partial** — `PaymentMethod.COMPLIMENTARY` exists, no UI distinction | `schema.prisma:76` |
| Hold / save order | Yes | **Full** | |
| Item cancellation with reason | Yes | **Missing** at item level; order-level cancel has a reason | |
| Offline billing | Heavily marketed, works | **Backend only** — `@zerosky/offline` has 46 passing tests and **zero imports** in any app | |

### Menu

| Capability | Petpooja | Zerosky | Evidence |
| --- | --- | --- | --- |
| Browse, search, filter, add to cart | Yes | **Full** | `/menu` |
| Variations and add-ons | Yes | **Full** — real DB-driven modifier groups with min/max and price deltas | `modifier-modal.tsx` |
| Create / edit menu items in the UI | Yes | **Backend only** — `menu.createItem`, `createMenu`, `setItemAvailability` all have zero callers | |
| Multiple menus per area / time | Yes | **Missing** | |
| Item shortcodes for fast entry | Yes | **Missing** | |
| Aggregator menu sync | Yes | **Missing** | |

### Kitchen

| Capability | Petpooja | Zerosky | Evidence |
| --- | --- | --- | --- |
| KDS with live tickets, mark ready | Yes, separate app | **Full** — plus a dedicated `apps/kds-display` on port 3002 | |
| Station-wise / multi-kitchen routing | Yes | **Missing** — `Kot.station` field exists, no routing logic | |
| KOT modification tracking (what changed) | Yes | **Partial** — `KotStatus.MODIFIED` exists, no diff logic | |
| KOT reprint | Yes | **Missing** — `markPrinted` exists but no reprint | |
| Physical thermal printing | Yes | **Backend only** — `@zerosky/print`, 84 passing tests, **zero imports** in any app | |

### Inventory

| Capability | Petpooja | Zerosky | Evidence |
| --- | --- | --- | --- |
| Item CRUD, stock in/out, low-stock alerts | Yes | **Full** | `/inventory` |
| Wastage | Yes | **Partial** — `StockAdjustment.type` includes WASTAGE, adjust UI supports it, no wastage report | |
| Recipe / BOM with auto-deduction | Yes, multi-stage | **Missing** — no schema at all | |
| Purchase orders | Yes | **Backend only** — 6 procedures, complete, **zero UI** | |
| Supplier management | Yes | **Partial** — model exists, appears as a dropdown, no management screen | |
| Variance report | Yes | **Missing** | |
| Central kitchen | Yes | **Missing** | |
| E-way bills | Yes | **Missing** | |

### Reports

| Capability | Petpooja | Zerosky | Evidence |
| --- | --- | --- | --- |
| Report count | Claims 80+ (inconsistently) | **6** | `reports.ts` |
| Sales summary, top items, hourly, daily, GST, inventory valuation | Yes | **Full**, all six, CSV export | |
| Daily P&L | Yes | **Missing** | |
| Staff action / audit report | Yes | **Missing** — no audit log model | |
| Discount and cancellation reports | Yes | **Missing** (nothing writes discounts) | |
| Multi-outlet head-office aggregates | Yes | **Missing** | |

Their "80+" is a category claim; we could only find one named report ("Manual
Adjustment Report") in public sources. Do not treat 80 as a real target — build
the reports an operator asks for.

### Customer and growth

| Capability | Petpooja | Zerosky | Evidence |
| --- | --- | --- | --- |
| Customer records | Yes, with 100+ label types | **Missing** — no Customer model. Only `Order.guestCount` (an integer) | |
| Loyalty and rewards | Yes | **Missing** | |
| SMS / campaign marketing | Yes | **Missing** | |
| Feedback collection | Yes | **Missing** | |
| Online ordering / own website | Yes | **Missing** | |
| Zomato / Swiggy integration | Yes, central to their pitch | **Missing** — `OrderType.AGGREGATOR` enum value only. Deferred by your decision | |
| QR / digital menu | Yes | **Missing** | |
| Table reservations | Yes, add-on | **Missing** | |

### Operations and configuration — our weakest area

| Capability | Petpooja | Zerosky | Evidence |
| --- | --- | --- | --- |
| Shift open / close, cashier handover | Yes | **Missing** — no Shift model anywhere | |
| Day close with validation | Yes | **Missing** | |
| Day-end cash reconciliation | Yes | **Missing** | |
| Cash drawer kick | Yes | **Backend only** — `escpos.ts:126` has the command, no UI trigger | |
| Tax configuration screen | Yes | **Missing** — tax is per-item `Item.taxRate`, no config UI | |
| Printer configuration screen | Yes, station-wise | **Missing** | |
| User roles | Yes, with per-right toggles | **Partial** — 5 roles, hierarchy only | `rbac.ts` |
| Granular per-capability permissions | Yes | **Missing** — no "can apply discount" style flags. `grep "can\.\|capability"` → 0 hits | |
| Multi-outlet switching | Yes, head-office module | **Missing** — `useBranch` silently picks the first branch | |
| Table / floor setup UI | Yes | **Backend only** — `table.create/update/setState` all uncalled | |
| Staff create / edit | Yes | **Missing** — `/staff` is a read-only list; there is no `staff.create` procedure | |
| Audit log | Yes | **Missing** | |
| **Appearance / theme customisation** | **None. No dark mode.** | **Full — 8 palettes × light/dark/system, persisted** | `theme.css`, verified in browser |

### Apps

| App | Petpooja | Zerosky |
| --- | --- | --- |
| Desktop/web POS | Yes (Windows/Mac/Android) | **Full** — Next.js web |
| KDS | Yes, separate app | **Full** — `apps/kds-display` |
| Captain / waiter app | Yes, with AI upsell + offline | **Scaffold** — Flutter in `apps/mobile` (6 tests), RN placeholder in `apps/mobile-app` |
| Owner / analytics app | Yes (4.5★ Android, 4.7★ iOS) | **Missing** |
| Tasks app | Yes | **Missing** |
| Payroll app | Yes | **Missing** |
| Order auto-acceptance app | Yes | **Missing** |

---

## 3. Scoreboard

| Domain | Petpooja | Zerosky | Verdict |
| --- | --- | --- | --- |
| Core billing flow | Full | Full | **Comparable** |
| Menu with modifiers | Full | Full | **Comparable** |
| KDS | Full | Full | **Comparable** |
| Basic reports | 80+ claimed | 6 real | Behind |
| Inventory basics | Full | Full | **Comparable** |
| Inventory depth (recipe, PO UI, variance) | Full | Thin | Well behind |
| Table operations (transfer/merge/split) | Full | None | Well behind |
| Shift & day lifecycle | Full | None | **Well behind — biggest gap** |
| Discounts & charges | Full | None | Well behind |
| Customer / CRM / loyalty | Full | None | Well behind |
| Aggregators & online ordering | Full | None | Deferred by choice |
| Configuration surface | Broad | Appearance only | Well behind |
| Permission granularity | Per-right | Role only | Behind |
| Multi-outlet | Full | None | Behind |
| **Visual design & theming** | **Dated, no dark mode** | **8 palettes, dark mode** | **We win** |
| **Performance** | 14 G2 complaints of slowness | Fast, but unproven at scale | **Likely ours** |
| **Test coverage** | No public evidence | 432 unit + 18 E2E | **We win** |
| Offline | Works, marketed | Built, unwired | Behind in practice |
| Payment gateway | Live | Razorpay built, unwired | Behind in practice |

---

## 4. What I would build, in order

The ranking is by *operator pain*, not by effort.

**Tier 1 — a restaurant cannot run a shift without these**

1. **Shift / day lifecycle.** Open with opening cash, close with counted cash and
   variance, gate billing on an open shift. Without this nobody can hand over a
   till or trust the day's numbers. This is the single largest gap.
2. **Discounts.** The column already exists and reports already read it. Nothing
   writes it. A POS that cannot discount cannot take a real order.
3. **Table transfer, merge, and bill split.** Every restaurant with more than
   four tables hits this on day one.

**Tier 2 — wire up what is already built and tested**

4. **Print.** 84 passing tests, zero imports. Add one tRPC procedure and a
   button and physical KOTs start printing.
5. **Razorpay.** Full gateway with refunds and webhooks, zero imports. Today
   `payment.record` trusts a client-supplied status.
6. **Offline.** 46 passing tests, zero imports. Their strongest marketing claim,
   and our engine is already written.

These three are the best effort-to-value trades in the whole list.

**Tier 3 — depth**

7. Customer records, then loyalty on top.
8. Order types in the UI (takeaway/delivery already in the enum).
9. Purchase-order UI over the existing backend, plus a supplier screen.
10. Menu editing UI over the existing `menu.createItem`.
11. Tax and printer configuration screens.
12. Per-capability permissions, multi-outlet switching, audit log.
13. Recipe/BOM and variance — the deepest and most valuable inventory work.

**Deliberately deferred:** aggregator integration, per your earlier decision.
Worth knowing it is central to Petpooja's pitch, so it will come up in any
serious sales conversation.

---

## 5. Real UI comparison — screen by screen

The first pass of this document was written from marketing copy and screenshot
*captions*. This section is different: every Petpooja claim below comes from an
image that was actually opened and read, and every Zerosky claim comes from a
screenshot of our own running app. Filenames are cited so any statement can be
re-checked.

**Evidence base.** Petpooja: 82 files in `/tmp/pp-ui/` — 50 iOS App Store
captures pulled from the iTunes Search API (9 Petpooja apps published by
"Prayosha Food Services Private Limited"), 14 Play Store captures, and two
full-resolution website captures. Ours: 32 captures in `/tmp/zs-ui/`, 12 screens
in light and dark. Large PNGs were downscaled with `sips -Z 1400` to be
readable; those views carry a `v2-` or `v-` prefix.

### 5.1 Floor / table view — our closest match

Petpooja `pos-view.png` (web POS, "Table View") against our `tables-light.png`.

| Element | Petpooja | Zerosky | Verdict |
| --- | --- | --- | --- |
| Section tabs | A/C (28 tables), Non A/C (9), Bar | PATIO, MAIN HALL | Same idea |
| State legend | 5 states: Blank / Running (blue) / Printed (green) / Paid / Running KOT (yellow) | 5 states with live counts: AVAILABLE·3 / OCCUPIED·0 / RESERVED·1 / BILLED·0 / CLEANING·0 | Ours is arguably clearer |
| Per-tile actions | Small **print** and **eye (view)** chips on every active tile | None — tile click only | **Gap** |
| Floor plan switcher | "Floor Plan: Default Layout" selector | Single hard-coded layout | **Gap** |
| Order-type entry | Red **Delivery** and **Take Away** buttons beside the grid | Dine-in only from this screen | **Gap** |
| Reservation / contactless | "+ Table Reservation", "+ Contactless" | Neither | **Gap** |
| Item movement | "Move KOT / Items" toggle | Merge Orders only | Partial |
| Top utility rail | Menu on/off, Store status, Live view, Online orders, Hold orders, Help centre, Zomato support, Wallet, Notifications, "Call for Support 9099912383" | Left nav only | **Gap** (mostly by design) |

The structure is genuinely close. What is missing is the operator shortcuts —
print/view from the tile, held orders, and starting a takeaway or delivery
without a table.

### 5.2 Order taking and cart

Petpooja `v2-ios-captain-phone-03.jpg` (item picker), `ios-captain-phone-02.jpg`
(cart) against our `menu-light.png`.

| Element | Petpooja | Zerosky | Verdict |
| --- | --- | --- | --- |
| Item grid | 2-column cards: price top-left, name, `customizable*` hint, coloured veg/non-veg/egg square | Cards with veg/non-veg mark, price, "GST 5%", Add button | Comparable; we show tax, they show customisability |
| Personalisation | Section header **"Jasdeep's Favorite"** above the category groups; web POS shows "Our Favourites" | None | **Gap** |
| Filters | Search only | Search, Vegetarian Only, Available Only, price-range slider, category chips | **We win** |
| Cart header | "Order for table : 3 / Final Order", "+ Waiter" | Cart panel, no waiter attribution | **Gap** (waiter) |
| Modifiers | Comma list with an "Edit" affordance | Modifier modal | Comparable |
| Print control | **"Print KOT in Kitchen" checkbox** in the cart | Print buttons live on `/kitchen` | Theirs is better placed |
| Confirm | Full-width red "Confirm Order"; phone bar shows "3.0 items ₹1356.00 View Order ›" | View Cart button | Comparable |

### 5.3 Dashboard and analytics — our weakest comparison

Petpooja `v2-ios-merchant-ipad-03.png` / `-04.png`, `ios-merchant-ipad-02.png`,
`v2-playstore-12.jpg` against our `dashboard-light.png` and `reports-light.png`.

| Element | Petpooja | Zerosky | Verdict |
| --- | --- | --- | --- |
| Headline card | "Total Sales" with **Total / Dine In / Take Away / Delivery** tabs, date range "6th May to 4th Jun", `20693 Total Sales – 75 Orders` split into Dine In 14568 (65) / Take Away 0 (0) / Delivery 6125 (10) | 4 flat KPI cards, all zero on empty data | **Gap** |
| Charts | Grouped daily bar chart with per-bar value labels; line chart for online orders; bar charts for discount and taxes | **No charts anywhere.** "Daily Sales Trend" is a table | **Gap** |
| Payment split | "Payment bifurcation" progress bars: Cash 14568, Card 0, Wallet 0, Due 0, Other 0, Online Paid 3791, Online COD 2334 | Payment Method Breakdown as text (CASH ₹261.45) | Data present, presentation thin |
| Tax detail | Taxes 635.34 broken into **SGST 319.42 / CGST 315.92** pills | GST Report tab exists | Comparable content |
| Audit counters | Per-outlet **Bills Modified, Bills Re-printed, Total Waived Off** | None | **Gap** — trust feature |
| Multi-outlet | Outlet switcher "Black Knight ▾", "All Restaurants / Kitchens" toggle, Export Data | Single active branch, Export Report | **Gap** |
| Period control | Month picker ("July 2021"), "Synced 15 minutes ago", "Last Thursday" comparison row, 30% delta chip | From/To inputs + Today / Last 7 / Last 30 | Comparable, no comparisons |
| Not-accounted sales | Zomato / Swiggy / Other split with a line chart | Deferred by decision | Known gap |

Their dashboard is a real analytics surface. Ours is accurate but flat: correct
numbers, no visualisation, no period-over-period comparison.

### 5.4 Kitchen and order lists

Ours: `kitchen-light.png` ("Kitchen Display / 0 active tickets", Show all +
Refresh, dashed "No tickets in the queue" empty state) and `orders-light.png`
("Orders / 1 order", status chips All → CANCELLED, table of ORDER / TYPE /
STATUS / ITEMS / TOTAL / CREATED, row `ORD-MS1KKOK2 · DINE_IN · PAID · 1 ·
₹261.45`).

No Petpooja KDS or order-list screen appeared in the 82 captures — their KDS is
sold as a marketplace add-on ("KDS Services", tagged *PetPooja Product /
Kitchen*, in `v2-playstore-03.jpg`). So this is **not** a comparison, it is an
unknown. Ours works; theirs was not observed.

### 5.5 Captain app — their operational hardening

`ios-captain-phone-00.jpg` / `ios-captain-01.jpg`, Captain v6.3 drawer: New KOT,
**Unsuccessful KOT (badge 1)**, Sync Data, Pending Bill, Update Menu, **Find
Server IP**, Contactless Pin, Settings, Logout, with a footer reading
"Device IP: 192.168.29.137".

That drawer is the clearest signal in the whole corpus. It says the waiter tablet
is expected to lose the network, so there is an explicit queue of failed KOTs, a
manual sync, and a LAN discovery tool. We have an offline engine with 46 passing
tests that is **not yet wired to any app** — `@zerosky/offline` has zero imports
in `apps/pos-web`. The capability exists, the operator-facing surface does not.

### 5.6 Marketplace and supplier

`v2-playstore-03.jpg` (Marketplace tab: add-on cards "Tvito" and "KDS Services",
"Get Started ›", a "1 Year Free" ribbon, QSR / Integration / Fine Dine category
tiles, embedded YouTube), `playstore-06.jpg` and `v-playstore-08.jpg` (Supplier
Hub with free-sample carousel and a "7,500+ suppliers on 2,500+ products"
claim). Bottom tab bar throughout: **Sales / Operation / Supplier / Marketplace
/ Other**.

We have nothing here, and that is the right call — it is a distribution business
built on their installed base, not a POS feature.

### 5.7 Visual language and theming

| Aspect | Petpooja | Zerosky |
| --- | --- | --- |
| POS palette | Red on white, dense, utilitarian (`pos-view.png`) | Semantic tokens, 8 palettes |
| Consistency across products | **Two different design languages** — red POS vs blue/indigo Invoice (`inv-view.png`) | One token system everywhere |
| Dark mode | None in the 82 captures, but a **"POS Dark" theme is specified** in their design system — see §7 | Light / Dark / System, no flash, persisted |
| Theme picker | Not observed | Appearance card: mode radios + 8 labelled palette dots + live "Table 12" bill preview (`settings-light.png`) |
| Empty states | Not observed | Honest ("No tickets in the queue", "Nothing to bill") |
| Login | Stock illustration, blush background, "Remember Me" (`ios-merchant-ipad-01.png`) | Clean token-based form |

Their Invoice product (`inv-view.png`) is the better-designed half of their
suite — left icon rail, KPI cards with ↑/↓ month-over-month deltas, multi-series
line chart with removable category chips, Profit & Loss, cashflow with a bank
selector — and it is worth borrowing from for our reports screen.

**Correction.** An earlier draft of this document said Petpooja has no dark mode
and that red is their brand colour. Both were wrong, and §7 explains why: the
screenshots are older than their current design system.

### 5.8 What this changes in the build order

Nothing is demoted. Three items get sharper:

1. **Charts on dashboard and reports** move up. Section 4 treated this as
   polish; side by side it is the most visible difference.
2. **Per-tile print/view chips, a floor-plan switcher, and Delivery / Take Away
   entry buttons** are small, cheap, and close most of the floor-view gap.
3. **Audit counters** (bills modified, re-printed, waived) are a trust feature we
   never listed. They are cheap given we already log order mutations.

---

## 6. Their real API contract (first-party evidence)

GitHub search for "petpooja" returns 206 repositories. Almost all are student
clones that merely borrow the name, but four contain production integration code
written against the live Petpooja API. Because Petpooja publishes no developer
docs, this is the strongest evidence we have of how their data model actually
works — stronger than any screenshot.

**Sources** (cloned to `/tmp/pp-gh/clones/`): `devjayantmalik/petpooja-webhooks`
(TypeScript request/response validators — the most authoritative, since every
field is typed), `efeone/petpooja_integration` (a Frappe/ERPNext app with real
sample payloads), `api-evangelist/petpooja` (four OpenAPI specs), and
`hyperzod/petpooja-sdk-php` (skeletal, auth pattern only).

### 6.1 Shape of the integration

| Aspect | Petpooja |
| --- | --- |
| Hosting | AWS API Gateway, `ap-southeast-1` (Singapore) — two separate gateways for menu and orders |
| Auth | `app-key` + `app-secret` + `access-token`, scoped by `restID`. Headers for menu calls, **body** for `save_order` — inconsistent |
| Credentials | Obtained by emailing `support@petpooja.com`. No self-serve developer portal |
| Endpoints | `/save_order`, `/update_order_status`, `/mapped_restaurant_menus`, `/update_item_stock`, `/update_store_status`, plus two partner-hosted webhooks (order callback, push menu) |
| Payload style | Deeply nested (`orderinfo.OrderInfo.Order.details`), and **every number is a string** — `"price": "359"`, `"quantity": "1"` |

### 6.2 Concepts their schema models that ours does not

This is the useful part. Each row is a real field name from their payloads.

| Concept | Their fields | Our schema | Gap |
| --- | --- | --- | --- |
| Item variations | `itemallowvariation`, `variation_id`, `variation_name`, `variation_groupname` | Modifiers only | **Missing** — size/portion pricing |
| Add-on groups with limits | `addon_group_id`, `addon_item_selection_min`, `addon_item_selection_max` | Modifiers, no min/max | Partial |
| Split payment | `part_payments[]` array of `{payment_type, amount, custome_payment_type}` | `payment.splitBill` exists | Comparable |
| Per-item GST liability | `gst_liability: "Restaurant"`, `item_tax[]` with named CGST/SGST rows | Tax computed per order | Partial |
| Charge-level tax | `dc_gst_details[]`, `pc_gst_details[]`, `dc_tax_percentage`, `pc_tax_percentage` | Service charge, no per-charge tax | **Missing** |
| Tax calculation base | `tax_coreortotal: "core" \| "total"`, `consider_in_core_amount` | Always on item subtotal | **Missing** — configurable base |
| Packing / delivery charges | `packing_charges`, `packaging_charge_type: "F" \| "P"`, `delivery_charges` | Neither | **Missing** |
| Round-off | `round_off: "0.40"`, with `core_total` separate from `total` | None | **Missing** — every Indian bill needs this |
| Discount type | `type: "P" \| "F"` (percent or flat), item-level *and* order-level | `DiscountType { PERCENT FLAT }`, both levels | **We match** |
| Discount rules | `discountdays`, `discounttimefrom/to`, `discountminamount`, `discountmaxlimit`, `discounthascoupon`, `discountordertype` | Manual discounts only | **Missing** — rule engine |
| Item exclusions | `ignore_taxes`, `ignore_discounts` per item | None | **Missing** |
| Sub-order type | `sub_order_type: "AC"` — AC vs non-AC pricing | Table `section` string | Partial |
| Cover count | `no_of_persons` | None | **Missing** |
| Pre-orders | `preorder_date`, `preorder_time`, `advanced_order` | None | **Missing** |
| Stock auto-resume | `autoTurnOnTime`, `customTurnOnTime` on stock toggle | None | **Missing** — nice idea |
| Store on/off | `store_status`, `turn_on_time`, `reason` | None | **Missing** |
| Prep time | `minimumpreparationtime` per item, `min_prep_time` per order | None | **Missing** |
| Category hierarchy | `categories` + `parentcategories` via `parent_category_id` | Flat categories | **Missing** |
| Item metadata | `cuisine[]`, `nutrition{}`, `item_favorite`, `itemrank` | Veg flag, no ranking | Partial |
| Order provenance | `order_from: "POS"`, `order_from_id`, `ondc_bap` | None | **Missing** |

Their order-status enum, verbatim: `Accept`, `Reject`, `Food Ready`,
`Delivered`, `Cancelled`. Order types: `Dine In`, `Delivery`, `Take Away`.

### 6.3 What this changes

Three items are now clearly under-scoped in section 4, and one is new:

1. **Round-off is not optional.** Indian bills round to the nearest rupee, and
   their schema keeps `core_total` and `total` separate to record it. We have no
   field for it. Small change, real correctness issue.
2. **Variations are a schema change, not a UI feature.** Half-plate versus
   full-plate is the most common Indian menu pattern, and modifiers cannot
   express it because the price differs, not just the description.
3. **Discounts need a rule engine eventually** — day-of-week, time window,
   minimum spend, maximum cap, coupon flag. Ours are manual only. Fine for now,
   but worth knowing the target shape.
4. **Per-charge tax** (packing and delivery each taxed at their own rate, with a
   `gst_liable` party) is real Indian GST complexity we have not modelled.

The API's shape is also a caution, not just a blueprint. String-typed numbers,
`orderinfo.OrderInfo` double nesting, and a misspelled `custome_payment_type`
are accidents of age. We should copy their *concepts*, not their encoding.

---

## 7. Their real design system — Pantheon

The most valuable find. `shrey-p28/pantheon` publishes **Petpooja's actual design
system** as a Claude plugin, including a 57 KB specification. Authorship is
verified: the commit author is `shrey.panchal@petpooja.com`, named in the README
as "Shrey, Senior Product Designer, Petpooja", and the files carry live Figma
file and library keys. This is first-party, not a fan reconstruction.

It also overturns two conclusions from §5, both of which came from reading
screenshots. Screenshots show the product as shipped, some of it years old; the
design system shows where they are going.

| What §5 concluded from screenshots | What their design system actually says |
| --- | --- |
| Brand colour is red | Brand is **`#1770ee`, "Petpooja blue"**. The red in `pos-view.png` is legacy; `#C52031` is specifically Reservation Manager's brand, a different product |
| No dark mode anywhere | **"POS Dark" is one of four specified themes** (POS Light, POS Dark, Billing, Payroll). The Gray ramp inverts under it, and Purple has a dedicated dark variant |
| Two clashing design languages | Confirmed, but deliberate: per-product themes over one shared token layer |

### 7.1 Their token architecture

Four semantic layers, which is the same idea as ours but more disciplined:
**`Surface/`** (fills), **`Text/`**, **`Border/`**, **`Icon/`**. Selected values:

| Token | Hex | Role |
| --- | --- | --- |
| `Buttons/Primary`, `Text/Brand`, `Border/Brand` | `#1770ee` | Brand blue |
| `Buttons/Primary Pressed` | `#125abe` | Active state |
| `Surface/Primary` / `Secondary` / `Tertiary` | `#ffffff` / `#fafafa` / `#f0f0f0` | Fill ramp |
| `Surface/Brand` | `#e8f1fd` | Selected rows, tonal fill |
| `Text/Primary` / `Secondary` / `Tertiary` | `#000000` / `#666666` / `#999999` | Text ramp |
| `Border/Primary` | `#e5e5e5` | Dividers, card borders |
| `Text/Error` | `#d92d20` | Error copy |
| `Surface/Error` / `Warning` / `Success` | `#fbeae9` / `#fef5d3` / `#eefff5` | Status fills |

Eight accent families with 9-step ramps: Aqua, Beige, Green, Yellow, Navy Blue,
Orange, Pink, Purple. **Multi-series charts cycle families, not steps** — never
Aqua-100 → Aqua-300 → Aqua-500 for three series. Status colours sit outside the
accent cycle so "palette red" and "error red" cannot collide.

### 7.2 Typography — "Prometheus"

Inter, branded internally as Prometheus. Four families × three sizes × four
weights, letter-spacing `0` everywhere:

| Family | Large | Medium | Small |
| --- | --- | --- | --- |
| Display | 32/40 | 24/32 | 20/28 |
| Title | 18/26 | 16/24 | 14/22 |
| Body | 16/24 | 14/22 | 12/20 |
| Label | 14/22 | 12/20 | 10/18 |

### 7.3 Their restraint rules

The interesting part is what they forbid. From their enforcement hook and spec:
**three corner radii only** (8px chips/inputs, 10px cards/buttons, 12px modals,
plus 200px pills); **one shadow** (`Elevation/3`, on modals only — cards get a
1px border and nothing else); 8-pt spacing grid with an explicit "don't invent
13px or 17px gaps"; no emoji anywhere, ever, replaced by Material Symbols; no
gradients, no skeuomorphism; no detached component instances. Button heights are
fixed at 32/36/40/48px. Their text input is a Material-3 outlined field with a
floating notched label, not a stacked label above the box.

They also ship a lint hook that force-refreshes the token set from Figma weekly,
which is a genuinely good answer to design-code drift.

### 7.4 What we should borrow

Concrete and scoped to our Tailwind v4 + semantic HSL setup:

1. **Rename our token layers to `surface/text/border/icon`.** Ours are close but
   less systematic. Their four-layer split prevents the `text-primary` on
   `bg-primary` contrast accidents we already had to fix once.
2. **Adopt the 12-step type scale.** We do not have a documented scale at all,
   and a POS specifically needs large numbers next to tiny metadata.
3. **Cycle palettes, not shades, when we add charts.** This decides the chart
   work in §5.8 before we write it.
4. **Cut our radii to three and our shadows to one.** Cheap consistency win.
5. **Keep status colours out of the 8-palette cycle.** We currently risk exactly
   the collision they warn about.
6. **Keep token names identical across light and dark** — only values change.
   We already do this; worth writing down as a rule.

Their theming model does *not* beat ours. They have four hard-coded product
themes; we have 8 palettes × light/dark with a live preview and per-user
persistence. The claim to drop is "they have no dark mode" — that was our
inference from old screenshots, and it was wrong.

---

## 8. Where I could not get evidence

Stated plainly so nothing here reads as more certain than it is.

- **Petpooja's settings screens.** No public help docs, and none of the 82
  captures shows a settings screen — only the gear icon in the Merchant top bar
  and a "Settings" row in the Captain drawer. We know the modules, not the
  screen structure or field-level options.
- **Their 80+ report names.** Only categories are public, plus one name.
- **Their KDS.** Sold as a marketplace add-on; no screen was ever shown.
- **How much of Pantheon (§7) is actually shipped.** It is a genuine first-party
  spec, but a design system describes intent. The screenshots show red where the
  spec says blue, so some of it is clearly not deployed yet. We know their
  direction, not their current state.
- **Their POS and KOT screen specs.** Pantheon covers tokens and components, and
  the companion repo covers Reservation Manager screens. Neither contains
  screen-level specs for the POS or kitchen display.
- **The 8 accent ramps in full.** Only the semantic tokens were extracted; the
  ~200 individual ramp values live in a `tokens.md` the repo does not ship.
- **The order-taking screen end to end.** The item picker and cart were read
  (§5.2), but no capture shows payment tender, bill settlement, or a KOT print
  dialog on the web POS.
- **Their pricing.** TechJockey cites a ₹10,000 base against Posist's ₹36,800,
  but petpooja.com publishes no prices.
- **Our own performance at scale.** Our app is fast on seeded demo data. That is
  not the same as fast on a year of real transactions during a Saturday rush,
  which is exactly the condition their users complain about.
