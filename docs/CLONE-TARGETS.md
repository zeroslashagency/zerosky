# Clone targets — what we lift, and from where

Surveyed 2026-07-27. Rule set by Jack: **licence is not a consideration.** Every
repo below is judged only on whether its code is worth taking.

Two evidence bases feed this list: the 206 "petpooja" repos on GitHub (§1, which
includes Petpooja's own first-party material) and a 138-repo survey of open
source POS and restaurant systems (§2 onward).

---

## 1. Petpooja's own repos — first-party, already cloned

These are not competitors' clones. They are Petpooja employees' own published
work, which is the closest thing to their internal source we will ever get.

| Repo | What it is | Value | Status |
| --- | --- | --- | --- |
| `shrey-p28/pantheon` | **Petpooja's real design system.** 57 KB spec, verified author `shrey.panchal@petpooja.com`. Tokens, 47 components, 4 themes incl. POS Dark, Prometheus type scale | **Highest.** Their actual visual language | Cloned, analysed in `COMPETITIVE-ANALYSIS.md` §7 |
| `samiksha-chawla/reservation-manager-design-system` | Reservation Manager design guidelines, web + mobile. 28 mobile components, 26 reservation card variants | High — reservations is a module we lack entirely | Cloned |
| `devjayantmalik/petpooja-webhooks` | TypeScript validators for their live API. Every field typed | **Highest.** Their real order/menu schema | Cloned, in `COMPETITIVE-ANALYSIS.md` §6 |
| `efeone/petpooja_integration` | Frappe app with real sample payloads (part-payment, discount, basic order) | High — real payload examples | Cloned |
| `api-evangelist/petpooja` | 4 OpenAPI specs + Postman collection | Medium — partly "unreconciled" | Cloned |
| `rutvijparikh/Pantheon-Design-System` | Sample tokens only | **None.** Generic GitFig boilerplate, not Petpooja tokens | Discarded |
| `dhiravpatel07/petpooja-UI-library` | Claims Pantheon components | **None.** Token files are empty stubs | Discarded |
| `Shoaibk2604/ui-replica-petpooja` | Replica of Petpooja **Tasks** marketing site | Low — brand green `#008745`, DM Sans, not POS | Cloned |
| `tmahajan90/billing-solution` | "Petpooja POS - Offline-first PWA" | Worth a look for offline patterns | Not yet cloned |
| `Rushabhsorathia/restaurant-management-system` | Petpooja clone, Laravel 11 + React 18, ships 56 Jira tickets and 6 milestones of specs | Worth reading for their **feature breakdown** | Not yet cloned |
| `arunandroapps/petpooja-platform` + `-api` | Multi-role SaaS (Superadmin/Distributor/Owner/Restaurant) | Medium — multi-tenant role model | Not yet cloned |
| `Rjworld09/Petpooja_Outomation-` | Playwright automation against the real Petpooja UI | **Interesting** — its selectors reveal their real DOM | Not yet cloned |
| `sarath50186-hash/petpooja-bigquery-automation` | Their report exports → BigQuery, 8-outlet chain | Reveals real **report column names** | Not yet cloned |

---

## 2. Primary clone targets — full POS systems

Ranked by how much working code we can actually take.

### Tier 1 — take the domain model

| Repo | ★ | Stack | Why it is the top target |
| --- | --- | --- | --- |
| **tastyigniter/TastyIgniter** | 3,673 | Laravel 12, PHP 8.3 | 10+ years of production restaurant domain. Multi-location, reservations, order workflow, coupons, delivery zones, staff roles. The schema is the prize |
| **opensourcepos/opensourcepos** | 4,312 | PHP/CodeIgniter | The most mature OSS POS overall. Registers, cash rounding, suspended sales, receipts, tax classes |
| **ury-erp/ury** | 320 | TypeScript/Frappe | Already our reference. Restaurant-specific, KOT, table management |
| **ury-erp/pos** | 98 | Vue | URY's actual POS screen — order-taking UI worth mirroring |
| **ury-erp/mosaic** | 45 | Python | **URY's Kitchen Display System.** We have no KDS reference at all; this is it |

### Tier 2 — same stack as us, copy patterns directly

| Repo | ★ | Stack | Take |
| --- | --- | --- | --- |
| **pizzaql/pizzaql** | 711 | Next.js + GraphQL | Order management in our own framework |
| **JoaoHenriqueBarbosa/FinOpenPOS** | 87 | Next.js + Supabase | Modern Next POS, closest structural match |
| **olasunkanmi-SE/restaurant** | 239 | TypeScript/NestJS | Clean restaurant domain in TS — direct port candidate |
| **hieuhani/simpos** | 148 | TypeScript | Odoo POS reimplemented in TS. **Someone already did the Odoo→TS translation** |
| **satisfecho/pos** | 22 | Python | Self-hosted multi-tenant realtime restaurant POS |
| **tngoman/Store-POS** | 1,015 | TypeScript/Electron | Desktop POS, offline-first patterns |

### Tier 3 — feature-specific lifts

| Repo | ★ | Take exactly this |
| --- | --- | --- |
| **enatega/food-delivery-multivendor** | 1,324 | Multi-vendor + rider tracking + full React Native app. Our mobile answer |
| **evan361425/flutter-pos-system** | 506 | **Flutter POS.** Directly seeds `apps/mobile-flutter` |
| **ucraft-com/POS-Awesome** | 509 | Vue POS screen for ERPNext — mature order-taking UX |
| **nestorbird/GETPOS** | 61 | ERPNext POS with **GST built in** — Indian tax handling |
| **IamRamgarhia/Free-GST-Billing-Software** | 28 | GST invoice formats, Indian compliance |
| **angkosal/laravel-pos** | 498 | Clean POS CRUD + reporting |
| **faizaldevs/RestoPOS** | 100 | Vue restaurant POS |
| **G4brym/Laravel-Restaurant-POS** | 79 | Table/floor management |
| **emreeren/SambaPOS-3** | 541 | C#. The classic restaurant POS — ticket/entity model is worth studying |
| **Pxrvn07/CampusBites** | 15 | TS canteen ordering + KDS |

### Tier 4 — printing (we already have `@zerosky/print`, but these are better)

| Repo | ★ | Take |
| --- | --- | --- |
| **mike42/escpos-php** | 2,785 | The reference ESC/POS implementation. Command tables, image/barcode encoding |
| **python-escpos/python-escpos** | 1,312 | Printer capability profiles for hundreds of models |
| **DantSu/ESCPOS-ThermalPrinter-Android** | 1,532 | Bluetooth/USB printing for the mobile app |
| **receiptline/receiptio** + **receiptjs** | 107 / 66 | **Node.js** receipt printing — directly usable in our stack |
| **grandchef/escpos-buffer** | 58 | **TypeScript** ESC/POS buffer generation — drop-in for `@zerosky/print` |
| **Hubertformin/electron-pos-printer** | 398 | If we ship a desktop shell |

---

## 3. What each target closes

Mapped against the gaps found in `COMPETITIVE-ANALYSIS.md`.

| Our gap | Source to copy from |
| --- | --- |
| No charts on dashboard/reports | pizzaql, FinOpenPOS, POS-Awesome |
| No item variations (half/full plate) | TastyIgniter menu schema, Petpooja `PushMenuRequest.ts` |
| No round-off, no `core_total` | opensourcepos (cash rounding), Petpooja payloads |
| No per-charge tax (packing/delivery) | Petpooja `dc_gst_details`/`pc_gst_details`, GETPOS |
| No discount rule engine | TastyIgniter coupons, Petpooja `discountdays`/`discountmaxlimit` |
| No KDS reference | **ury-erp/mosaic**, CampusBites |
| No reservations | TastyIgniter, Petpooja Reservation Manager design system |
| No customer/loyalty | TastyIgniter, enatega |
| No floor-plan switcher, no per-tile actions | ury-erp/pos, Laravel-Restaurant-POS, POS-Awesome |
| No audit counters (bills modified/reprinted) | opensourcepos (suspended sales, register audit) |
| Offline engine unwired | tngoman/Store-POS, tmahajan90/billing-solution |
| Print unwired to real hardware | escpos-buffer (TS), receiptio (Node), escpos-php (reference) |
| Mobile app not at parity | flutter-pos-system, enatega |
| No aggregator integration (deferred) | Petpooja `save_order` contract is the spec when we do it |
| No design token discipline | **Pantheon** (already extracted) |

---

## 4. Deliberately excluded

| Repo | Why not |
| --- | --- |
| `odoo/odoo` | 16.5 GB. The POS is Python + XML + OWL templates. Nothing ports to Next.js |
| `OCA/pos` | **Not a POS.** 25 Odoo plugins, 2,599 lines of Python total. Every module only `_inherit`s Odoo's `pos.order`. There is no engine here to copy — verified by cloning it |
| `frappe/erpnext` | 1.75 GB ERP. URY already extracts the restaurant parts for us |
| `PostHog/*`, `postgres-*`, `postiz` | Search noise — matched on "pos" |

Note on `OCA/pos`: it was the starting point for this request, so the finding
matters. It is a plugin collection, not a system. `hieuhani/simpos` is the repo
that actually does what was wanted — it reimplements the Odoo POS in TypeScript.

---

## 5. Clone order

Nothing is cloned into the repo. Everything lands in `/tmp/pos-survey/` for
reading, and only ported code enters `zerosky-repo`.

1. **Schema pass** — TastyIgniter + opensourcepos + URY. Produce one merged
   restaurant schema, reconciled against Petpooja's API field names.
2. **KDS + floor pass** — ury-erp/mosaic, ury-erp/pos, POS-Awesome.
3. **TS pattern pass** — simpos, FinOpenPOS, pizzaql, olasunkanmi-SE/restaurant.
4. **Print pass** — swap `@zerosky/print` internals for escpos-buffer + receiptio.
5. **Mobile pass** — flutter-pos-system seeds `apps/mobile-flutter`; enatega for
   the delivery/rider side.
6. **Design pass** — Pantheon tokens and type scale over our existing 8 palettes.
