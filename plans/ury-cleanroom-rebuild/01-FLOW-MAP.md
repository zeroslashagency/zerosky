I havecomplete coverage. Hereis the structured behavior map.

---# URYRestaurant POS —Structured Behavior MapStack context: Frappe/ERPNext app.POS v2 = React (`/pos`),POS v1 legacy = Vue (`/urypos`), KDS =Vue (`/URYMosaic/<unit>`), management =React (`/ury`). Core orderdoc is `URYOrder` → becomesERPNext `POSInvoice` → `Sales Invoice` onconsolidation.

## 1. POS / Billing
- **Shift gate**: no `POS Opening Entry` forthe day → table selection blocked. `Require Daily POS Closing` validates prior day isclosed beforeopening new.- **Order-type entry**: pick ordertype (Dine In /Take Away/ Delivery / Aggregator— dynamic via `URY Order Type`)then proceed. Aggregatororders use a dedicated customer + pricelist+ payment mode perbranch.
- **Dine-in flow**: selectroom→ selecttable (status badges:Free/Occupied/Attention/Active) → add menu items → addcustomer +pax → **Update** (creates draft POS Invoice +fires initial KOT) → ordersitsUnbilled → **Bill** (generatesbill, clears table) → **MakePayment** (select mode ofpayment,settle).- **Takeaway/QSR fast-checkout flow**: singleunified page (v2)— searchitem→ clickadds to cart → customer →Update → redirect to OrderLog, or immediate checkout.
-**Cart operations**: qty +/- ,qty-click dialog forprecise edit + item-wise comment, delete line, order-level comment, grand total;shows invoice #, waiter, POS profile, cashier.Buttons: Update, Cancel (voids draft +clears table), KOT Reprint.
- **Orderlog /status filters**: Draft,Unbilled,Recently Paid (limitfromprofile), Paid,Consolidated, Return(lastthree gated by "AllowCashier to View AllStatus"). Actions:Edit, PrintReceipt, MakePayment, CancelOrder.
- **Advanced table/bill ops (v2)**: Table Transfer (ordermoves table,oldcleared), Captain/waiterTransfer, **TableMerge** (groupmultiple tables into one order),**Bill Merge**(consolidate multiple draft invoices fora group), **Bill Split**(split itemsacrosscustomers/newinvoices).- **Discounts**: enabled perPOSProfile.- **Multi-cashier**: multiple cashiers underone POS Profile; maincashier opens first, sub-cashiers openafter; room-restricted access.
- **Offline mode** (README-stated).

## 2. KOT / KDSKitchen (URY MOSAIC)
-**KOT lifecycle byaction**:-Initial KOT —on orderplace(Update / checkout).- Modified KOT — adding itemor increasing qty on existing order(orange).
  - Partially-cancelled KOT —removing item /reducing qty (red).- CancelledKOT — whole order cancelled (red), requires kitchen "Confirm".
- **Service status flow**: New→ (KDS marks)Preparing → Ready→ **Serve** (removes card,stamps serve time); itemsindividually markable served/unserved.
- **KDS display**: cards showorder type, table name, user, invoiceID asOrder ID, KOT created time, item+qty+item-comment, order-level comment; cancelled cards show availablevs oldqty.- **Color codes**: white= newdine-in, blue = new takeaway,orange = modified, red =cancelled/partial.- **Alerts**: per-KOT warning timer("KOT WarningTime"), audio alertonnew KOT ("KOT Audio Alert"+ sound file), KOT delay notifications to recipient roles("Notify KOTDelay").
- **Real-time**:Socket.iochannel `kot_update_{branch}_{production_unit}`; live new-KOT + table-changeupdates.
- **Scheduled validation**: `kotValidationThread`runs every minute tovalidate KOT state;`URY KOT ErrorLog`captures failures.- **Multi-kitchen routing**: each `URYProduction Unit` = ownKDS URL + item groups + printers; optional order-type-wise filtering perunit (KDSOrder Type childtable);block-takeaway-KOT option.

##3. Inventory /Recipe / BOM
-Items linked toERPNext **stock +accounting** modules;real-time inventory checks before orderplacement.
- **Recipe mapping viaBOM**; combos/bundles viaERPNext **ProductBundle**; modifiers via`Item Add On`;size/variant via `POSItem Variants`.
-**Production planning** integration for daily prep; per-outlet portions/availability control.
- **COGS**: `URY Cost ofGoods` computes cost ofitemssold factoring productbundles +BOM sub-items (feeds P&L).
- Warehouse auto-bound perproduction unit.## 4. Shift & Cash Reconciliation
- **POS Opening Entry**(percashier, perday, sets restaurant/branch/room + last-invoiceref).
- **Sub POS Closing**(`Sub POS Closing`+ payment/invoice childtables) — eachsub-cashier reconciles owntransactions.- **POS ClosingEntry** — main cashier closes theday; day-closemandatory tocomplete operations.
-Reconciliation covers cash +mode-of-payment totalspercashier.## 5. Multi-Outlet /Menu
-Hierarchy: **Company → Branch → URYRestaurant → URYRoom → URY Table**.
-Branch defines allowed POS users +aggregator config;userpermissions restrict POS Profile/Branch/Room access.
- **URY Menu** perrestaurant/branch, linked to aPrice List; **room-wise menu** and **order-type-wise menu**(differentprice lists).- `URY Menu Item`(rate, image, special/priority flag, disable flag); `URY MenuCourse` (Starters/Mains/Desserts withservepriority; "Indicatein KDS" drives prep/serve order).
- **Visual table layout editor**: drag-drop grid, resize/scale,shape assignment (Circle/Square/Rectangle via`URY Table`), savepersisted layout perroom.
- i18n +RTL (Arabic) support inv2.

## 6.Analytics / Reports- **Daily P&L** (`URY DailyPandL`):GrossSales,Direct Expenses (consumables/burning materials cost-per-unit + direct fixed), COGS(bundles + BOM),Gross Profit/Loss, Employee Cost (fromattendance:salary/daily-wage), IndirectExpenses (electricity per unit + indirect fixed + percentage-of-sales expenses + depreciation),Net Profit/Loss. Configured in `URY Report Settings` (buying price list, expense tables, extended/branch hours).
- **Reports (14)**:Today's Sales,Daywise Sales,Daywise Invoices,Month Wise Sales, AverageBill Value, Cancelled Invoices,Item Wise Sales, Customer Data,Repeated Customers,Daywise CustomerDetails, Employee Sales, Employee Item Wise Sales, ServiceWise Sales, TimeWise Sales.- **Operational red-flags/alerts**:delayed orders, prep-time breaches, KOT-not-started,unclosed bills, prolonged occupancy, excessive KOT cancels/mods; dashboard acrossoutlets.

## 7.Auth / Roles- Threeroles: **URY Manager** (fullops), **URY Cashier** (orders + table+ payments+POS), **URY Captain** (orders + table service,no payment).
- Frappe DocType-level perms perrole (read/write/create/submit/cancel matrix);**User Permissions** scope recordsto POS Profile + Branch.
- POS-Profile restrictions:Captain-Transfer role, Role-Allowed-For-Billing(defines cashiers), Role-Restricted-For-Table-Order, cashier view-all-status toggle, cashier edit/remove-table-itemstoggle.- Branch usertablegates which users can access thatbranch's POS.

##8. Printing- **Bill/invoice print** +**KOT print**, bothroom-wise and production-unit-wise (printer configured per URY Room and per ProductionUnit printers tablewithKOT print format).
-**Three transports(priority order)**:(1) **QZTray** — signed printjobs, `qz_host` per profile, cert +jsrsasign signing; (2) **Network printing**(CUPS /ERPNext Network Printer Settings) when QZdisabled; (3) **Websocket printing** (`/app/websocket-print`) fallback when neither configured.
- KOT reprint feature (toggle +printer + format); invoice`invoice_printed` flag tracked.

---

Key sourceanchors: docs at`/Users/xoxo/Documents/resreah/billing/_reference-study/ury/{FEATURES.md,README.md,SETUP.md,AGENTS.MD}`; backend API `ury/ury_pos/api.py` +`ury/ury/api/*.py`;36 doctypes in `ury/ury/doctype/`; 14reports in `ury/ury/report/`; React POS pages `pos/src/pages/{POS,Table,Orders}.tsx`;KDS `URYMosaic/src/views/Home.vue`.