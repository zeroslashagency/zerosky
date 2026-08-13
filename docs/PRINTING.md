# Printing

`@zerosky/print` is a complete ESC/POS thermal printing engine. This document describes how to configure printers, the available transports, and how to test without hardware.

## Architecture

- **`packages/print/src/`**: The print engine — ESC/POS command builder, templates (KOT, receipt, invoice), printer discovery (USB/network), and a retrying print queue.
- **`packages/api/src/routers/print.ts`**: tRPC procedures that bridge the POS UI to the print engine.
- **Print queue**: All print jobs flow through a shared `PrintQueue` (singleton) with exponential backoff retry (default 3 attempts, max 5s backoff). A paper jam or offline printer will not block order creation; the queue fails gracefully and surfaces a tRPC error.

## Transports

The driver supports three transports, selected via environment variables:

### Mock (default, no hardware)

```bash
PRINTER_TRANSPORT=mock
```

The `MockPrinter` records all writes in memory and never fails. Used in dev/CI where no physical printer exists. Every print "succeeds" immediately — the rendered ESC/POS bytes are buffered but never sent to hardware.

### Network (TCP raw socket)

```bash
PRINTER_TRANSPORT=network
PRINTER_HOST=192.168.1.100
PRINTER_PORT=9100
```

Opens a raw TCP socket to a network thermal printer (e.g., Epson TM-T88VI over Ethernet). Port 9100 is the ESC/POS standard. If the printer is unreachable, the job will retry and eventually fail with a clear tRPC error.

### USB (not yet implemented)

```bash
PRINTER_TRANSPORT=usb
PRINTER_VENDOR_ID=0x04b8
PRINTER_PRODUCT_ID=0x0202
```

Requires the optional `usb` dependency. Not wired yet — falls back to `mock` when selected.

## Paper width

```bash
PRINTER_WIDTH=80  # or 58 (mm)
```

Controls column count (48 for 80mm, 32 for 58mm). Templates auto-wrap item names and adjust layouts. Defaults to 80mm.

## Printer discovery

The router exposes a `listPrinters` procedure that scans for available printers:

- **USB**: Enumerates all connected USB devices filtering to class `0x07` (printer class).
- **Network**: Probes a list of hosts for an open port 9100. Configure scan targets:

```bash
PRINTER_NETWORK_SCAN_HOSTS="192.168.1.100,192.168.1.101,192.168.1.102"
```

Discovery is used by setup/config UIs; the runtime transport (used for actual printing) is set once via env.

## Print procedures

All procedures are branch-scoped and role-restricted:

- **`print.printKot({ kotId })`**: Fetch the KOT, render via `buildKot`, enqueue the job, and mark `printedAt`. Fails if the KOT does not exist or belongs to a different tenant.
- **`print.reprintKot({ kotId })`**: Same as `printKot`, but the rendered ticket is flagged `(REPRINT)` in the header so kitchen staff know it is not a new order.
- **`print.printBill({ orderId, fullInvoice })`**: Render a receipt (default) or full GST invoice. A receipt is compact and suitable for walk-in customers; an invoice includes buyer GSTIN, per-item HSN, and a CGST/SGST or IGST breakdown.
- **`print.openCashDrawer({})`**: Pulse the cash-drawer kick pin. Typically called after payment.
- **`print.listPrinters({})`**: Discover available printers. Returns `[{ kind, name, address }]`.

## UI integration

`apps/pos-web/hooks/use-print.ts` exports tRPC mutation/query hooks:

```tsx
import { usePrintKot, usePrintBill, useOpenCashDrawer } from '@/hooks/use-print';

const { print, reprint } = usePrintKot();

<button onClick={() => print.mutate({ kotId })}>Print</button>
<button onClick={() => reprint.mutate({ kotId })}>Reprint</button>
```

The Kitchen Display (`/kitchen`) shows a print/reprint button per KOT card. Loading and error states are visible; a failed print surfaces a toast/banner rather than silently succeeding.

## Error handling

- **Printer unreachable**: The queue retries with exponential backoff. After 3 attempts the job is marked `failed` and a `TRPCError(INTERNAL_SERVER_ERROR)` is thrown. The UI shows the error; the order/KOT transaction is NOT rolled back — printing is a side effect.
- **No physical printer in dev**: Mock transport always succeeds. Developers can test the UI flow without hardware.
- **Serialization gotchas**: Prisma `Decimal` columns are converted to plain numbers at the API boundary (`Number(...)`) before passing to templates. The templates expect plain JS numbers, not Decimal instances.

## GST logic

Receipts and invoices compute tax automatically:

- **Intra-state supply** (seller and buyer in the same state): tax is split 50/50 into CGST + SGST.
- **Inter-state supply**: tax is charged as IGST.
- State is determined from the first 2 digits of the GSTIN. If no GSTIN is available, defaults to intra-state.
- Amounts are tax-inclusive (the unit price in the DB includes tax). The formatter (`packages/print/src/formatter.ts`) decomposes gross → taxable base + CGST/SGST/IGST.

## Testing without hardware

1. Leave `PRINTER_TRANSPORT` unset or set it to `mock`.
2. The queue will "print" successfully to the `MockPrinter`, which records all bytes in memory.
3. Use the print button in the Kitchen Display to verify the UI flow.
4. Tests (`packages/api/tests/print.test.ts`) use the mock transport so they run without hardware dependencies.

## Real hardware (unverified)

**No physical printer has ever been connected to this codebase.** The network transport is implemented per the ESC/POS spec and Epson/Star documentation, but real-world quirks (paper size mismatches, font encoding, drawer pin numbering) are unknown. When a printer is first attached:

- Verify the paper width (58mm or 80mm) and set `PRINTER_WIDTH` accordingly.
- Test the cash-drawer pin (default is pin 0; some models use pin 1). The command is `ESC p m t1 t2` — see `escpos.ts:126`.
- Check text encoding. The driver sends UTF-8; older printers may expect Code Page 437 or a custom charset. If accented characters render as garbage, encoding conversion will be needed.

## Cash drawer wiring

Most thermal printers expose a 5-pin RJ11/RJ12 drawer port. Pins 3 and 4 are the pulse signal (driven by `ESC p`). The drawer must be connected before `openCashDrawer` will have any effect. If the drawer does not open, verify:

- The cable is seated properly.
- The drawer is powered (some models need external 12V/24V).
- The pin number matches the hardware (try pin 1 if pin 0 fails).

## Future work

- **USB transport**: Requires the optional `usb` or `serialport` dependency. The discovery code is already written; the transport stub exists but is not wired.
- **Printer config table**: Currently all printer settings are in env vars. A future migration could add a `printers` table (per-branch, with fallback/redundancy), but per instructions the schema is frozen for now.
- **Offline queue persistence**: The current `PrintQueue` is in-memory. If the server restarts, pending jobs are lost. A durable queue (Redis, SQLite) would survive restarts.
- **Reprint from history**: The KOT `printedAt` timestamp is recorded but there is no UI to list previously printed tickets. A "reprint history" view could be added.

## Dependencies

- `@zerosky/print`: Zero imports. Fully self-contained ESC/POS engine with 84 passing tests.
- `usb` (optional): For USB printer enumeration. Lazy-loaded; if missing, USB discovery returns `[]`.
- `serialport` (optional): For USB-serial printers. Lazy-loaded.

## References

- ESC/POS Command Reference: [Epson TM-T88VI](https://reference.epson-biz.com/modules/ref_escpos/)
- GST Invoice Requirements: [CBIC Guidelines](https://www.cbic.gov.in/)
- `packages/print/tests/`: 84 tests covering formatter, templates, queue, discovery, and transports.
