I havecomplete coverage. Here isthe deep-verifyresult.

---

#Inventory /Recipe / BOM verification — zerosky-repo vs spec-spec-3**Bottom line upfront:** There is **NO recipe → depletion→ COGS chain atall.** The codebase implements a generic warehouse-styleinventory (stock items, suppliers, purchase orders, manual adjustments) thatis **completely disconnected from selling**.Selling adish moves zero stock. Thereis noRecipe/BOM entity, no bundle,no cost roll-up. The spec'ssinglenon-trivial algorithm (recursive cost roll-up,R3–R7) is entirely absent.## Thethreecore questions- **Recipe → depletion?** ❌ No recipe model exists;no codepathdeductsingredient stock onsale. `order.ts`/`payment.ts`/`billing.ts` contain zero referencesto `inventoryItem`/`stockAdjustment`/`currentStock` (grep returned nothing).
- **Depletion → COGS?** ❌ Nosales-driven COGS anywhere.Only `reports.inventoryValuation` exists — astatic snapshot `currentStock × unitCost` (`reports.ts:354`), whichis balance-sheet valuation, not cost-of-goods-sold.
- **Any recipe/BOM/bundle primitive?** ❌Repo-wide grep for `recipe|cogs|bom|deplet|bundle|warehouse|buying.?price|productionunit|consumable` acrossall `.ts/.tsx/.prisma` returnedonly one unrelated hit (acomment aboutJS "bundles" in `print/escpos.ts:195`).

## Itemized againstspec

###Domain entities (§2)
| Entity |Status | Evidence |
|---|---|---|
| Sellable Item / Menu Item |🟡 | `Item` exists (`schema.prisma:193`) but isa plain menu row—no linkto astock/sellable join, no name-sync hook |
| Recipe(BOM) w/ active/default/confirmed |❌ | No model. `schema.prisma` hasno Recipe/RecipeComponent || Bundle /combo | ❌ |No model,no `isBundle` flag on`Item` |
|Modifier (add-on →Sellable Item) |❌ (asspec'd) | `Modifier`(`schema.prisma:234`) is a priced text labelunder`ModifierGroup`; itdoes **not** reference anotherItem/Sellable Item, so itcarries no cost/stock behavior (violates §2,R9) |
| Variant| ❌ | No variant model atall |
| Production Unit (Kitchen) → Warehouse | ❌| NoProductionUnit model.`Kot.station` (`schema.prisma:339`) is a free-text string, not a warehouse binding |
| StockLocation /Warehouse |❌ | No Warehouse model. `InventoryItem` has no location; stock is asingle global `currentStock` scalar (`schema.prisma:392`) |
| Buying Price List(per-branch) |❌ | None. Cost isa single `InventoryItem.unitCost` (`schema.prisma:397`), not a per-branch price list |
| Consumable Material | ❌| Nomodel |
| COGSLine | ❌ | Nomodel,no computed structure || Order carries affect-stock flag + warehouse |❌ | `Order`(`schema.prisma:276`) has no `affectStock` flag andno warehouse FK |

### State machines (§3)
-**3.1 Stock-depletion lifecycle**❌ —NoDraft→Pending→Depleted→Reversed.Order finalization (`order.ts`, `payment.ts`) posts nostock movement. Cancel/returnreverses nothing. Theonly outward movementis *manual* via`inventory.adjustStock` type`OUT`/`WASTAGE` (`inventory.ts:109-164`), operator-driven, not sale-driven.
- **3.2Recipe effective-state selection** ❌— No recipe,no three-flag gate.- **3.3 COGS / daily P&Llifecycle (Draft→Saved→Submitted)**❌ — No suchdocument;`reports.ts` queries are stateless reads.

### Business rules/ invariants (§4)| Rule | Status| Note|
|---|---|---|
| R1 Dishes notstocked; ingredientsdepleted onsale | ❌ |Dishes (`Item`) and ingredients (`InventoryItem`) are unrelated tables;no FK,no depletion || R2 Effective-recipe gate |❌ | No recipe|
| R3 Recursive expansion + batchnormalization | ❌| No expansion algorithm anywhere |
| R4Bundle expansion| ❌ | No bundle |
| R5Three-wayclassification (plain/recipe/bundle) |❌ | No classifier |
| R6Buying-price sourcing from branch list | ❌ |Only global`unitCost`; nobranch price list,no "unpriced" concept |
| R7Unpriced-item collection +dedup+ remarks | ❌ |Absent |
| R8Warehouse binding fixed per kitchen | ❌| No warehouse,no kitchen binding |
| R9Menu-membership invariant for modifiers/variants | ❌ |`Modifier` doesn't reference anItem,so itcan't be validated againstmenu membership; no variants; item`create`/`update` (`menu.ts`) doesno such check|
| R10 Namesynchronization on rename | ❌ | `Item.name` hasno downstream presentation to sync;nohook |
| R11 COGS window (late-night offset) | ❌ |No COGS;reports useplain calendar boundaries || R12 Consumables as separate expense stream | ❌ | Noconsumable model |
| R13 Quantities (batch≠ 0,etc.) |🟡 |Partial &unrelated: `adjustStock` blocks negative resulting stock (`inventory.ts:136`),PO qty `min(0.01)` (`purchaseOrder.ts:62`). No recipe-batch-divisor validationbecause norecipe || R14 Availability read-through,noreservation |🟡 | Trivially "satisfied" onlybecause noavailability/reservation exists atall —cart flow never consults `InventoryItem` |### Edge cases (§5)All 13❌ — everyonepresupposes recipe/bundle/COGS/warehouse machinery that doesnot exist (unpriced lists, nested-recipe normalization, late-night window, post-finalization reversal dropping outofCOGS, etc.).None are reachable.

### Permissions (§6)❌ /🟡 —Spec'sManager/Cashier/Captain matrix overrecipes,bundles, warehouse bindings, andtheCOGS/P&L doc is not modeled. Only ageneric `UserRole`enum (`schema.prisma:20`:OWNER/MANAGER/CASHIER/WAITER/KITCHEN)exists, and everyinventory/PO/supplier procedure is abare `protectedProcedure` (e.g. `inventory.ts:7`, `purchaseOrder.ts:7`,`supplier.ts:7`) with **no role gating** — aWAITER can create/delete inventory,receive POs, andadjust stock.##What *does* exist (andis fine forwhatit is)
-🟡 `InventoryItem` CRUD + low-stock alerts + manual `adjustStock` withaudit trail via`StockAdjustment` (`inventory.ts`whole file; `schema.prisma:382,486`). Solid generic stock tracking.
- 🟡`Supplier` CRUD withdelete-guard (`supplier.ts:87-104`).
- 🟡`PurchaseOrder` create/receive →increments `currentStock` and writes an`IN` `StockAdjustment` (`purchaseOrder.ts:133-218`). This is the **only** automatedstock movement,and it's *inbound only*.
-🟡 `reports.inventoryValuation` —static on-hand value, not COGS (`reports.ts:342-381`).

### Notable correctness bugs in the parts that exist (evenignoring thespec)
-❌ `purchaseOrder.receive` runs a**per-item `$transaction`** inside `Promise.all` (`purchaseOrder.ts:160-202`)— partial receives arenot atomic acrossitems; amid-loop failure leaves some stock updated,some not, and the order stillflips to `RECEIVED` afterward.
- ❌PO order-number generationis race-prone andfragile: `parseInt(orderNumber.replace('PO',''))+1` (`purchaseOrder.ts:74-77`) with no unique-retry;concurrent creates collide on `@unique orderNumber`.
-🟡 `receivedQuantity` on re-receive isn't blocked atitem level(only whole-order `RECEIVED` guard at`purchaseOrder.ts:152`).## Verdict
Spec-spec-3 describes a recipe/BOM stock-control +COGS roll-up subsystem.The repo implements **noneof therecipe/BOM/bundle/COGS/warehouselayer**.What'sshipped is anindependent purchasing-and-stock modulewith noconnection to menu,orders, or profitability. Estimated coverage ofthe spec: **~5%**, and that5% is only the genericinventory-holding substrate thespec explicitly says totreat as the*underlying engine* (§7), not the subsystem-specific logic thespec asks tobuild.

Files reviewed:
- `/Users/xoxo/Documents/resreah/billing/zerosky-repo/packages/api/src/routers/inventory.ts`
- `/Users/xoxo/Documents/resreah/billing/zerosky-repo/packages/api/src/routers/purchaseOrder.ts`- `/Users/xoxo/Documents/resreah/billing/zerosky-repo/packages/api/src/routers/supplier.ts`- `/Users/xoxo/Documents/resreah/billing/zerosky-repo/packages/api/src/routers/reports.ts` (COGS check)
- `/Users/xoxo/Documents/resreah/billing/zerosky-repo/packages/database/prisma/schema.prisma`