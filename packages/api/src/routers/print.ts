// Print router: send KOTs, bills, and invoices to thermal printers.
import { TRPCError } from "@trpc/server";
import {
  printKotSchema,
  reprintKotSchema,
  printBillSchema,
  openCashDrawerSchema,
} from "../schemas/print.js";
import { protectedProcedure, roleProcedure, router } from "../trpc.js";
import {
  renderKot,
  renderReceipt,
  renderInvoice,
  MockPrinter,
  NetworkPrinter,
  PrintQueue,
  discoverAll,
} from "@zerosky/print";
import type { PrinterTransport, KotData, ReceiptData, InvoiceData, PrintLineItem } from "@zerosky/print";
import { EscPosBuilder } from "@zerosky/print";
import { z } from "zod";

// ─────────────────────────────────────────────────────────────
// Transport factory: read env and select mock/usb/network
// ─────────────────────────────────────────────────────────────

const PRINTER_TRANSPORT = process.env.PRINTER_TRANSPORT ?? "mock";
const PRINTER_HOST = process.env.PRINTER_HOST ?? "localhost";
const PRINTER_PORT = process.env.PRINTER_PORT ? parseInt(process.env.PRINTER_PORT, 10) : 9100;
const PRINTER_WIDTH = process.env.PRINTER_WIDTH === "58" ? 58 : 80;

function createTransport(): PrinterTransport {
  if (PRINTER_TRANSPORT === "network") {
    return new NetworkPrinter({ host: PRINTER_HOST, port: PRINTER_PORT });
  }
  // USB not implemented yet (requires serialport/usb dep), falls back to mock.
  // "usb" case would go here.
  return new MockPrinter();
}

// Singleton queue shared across all print calls so jobs serialize.
let printQueue: PrintQueue | null = null;

function getQueue(): PrintQueue {
  if (!printQueue) {
    printQueue = new PrintQueue(createTransport(), {
      maxAttempts: 3,
      backoffMs: 100,
      maxBackoffMs: 5000,
    });
  }
  return printQueue;
}

// ─────────────────────────────────────────────────────────────
// Helper: fetch KOT with order and items, build print payload
// ─────────────────────────────────────────────────────────────

async function fetchKotData(ctx: any, kotId: string, isReprint: boolean): Promise<KotData> {
  const kot = await ctx.db.kot.findFirst({
    where: {
      id: kotId,
      order: { branch: { tenantId: ctx.auth.tenant.id } },
    },
    include: {
      order: {
        include: {
          table: true,
          branch: true,
        },
      },
      items: true,
    },
  });

  if (!kot) {
    throw new TRPCError({ code: "NOT_FOUND", message: "KOT not found." });
  }

  const kotData: KotData = {
    kotNumber: isReprint ? `${kot.kotNumber} (REPRINT)` : kot.kotNumber,
    orderNumber: kot.order.orderNumber,
    station: kot.station ?? undefined,
    tableName: kot.order.table?.name ?? undefined,
    orderType: kot.order.type,
    createdAt: kot.createdAt,
    items: kot.items.map((item: any) => ({
      name: item.name,
      quantity: item.quantity,
      modifiers: item.modifiers
        ? (item.modifiers as Array<{ name: string; price: number }>)
        : undefined,
      notes: item.notes ?? undefined,
    })),
  };

  return kotData;
}

// ─────────────────────────────────────────────────────────────
// Helper: fetch order with items, build receipt or invoice
// ─────────────────────────────────────────────────────────────

async function fetchOrderData(ctx: any, orderId: string, fullInvoice: boolean): Promise<ReceiptData | InvoiceData> {
  const order = await ctx.db.order.findFirst({
    where: {
      id: orderId,
      branch: { tenantId: ctx.auth.tenant.id },
    },
    include: {
      branch: {
        include: {
          tenant: true,
        },
      },
      table: true,
      createdBy: true,
      items: {
        include: {
          item: true,
        },
      },
    },
  });

  if (!order) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Order not found." });
  }

  const items: PrintLineItem[] = order.items.map((oi: any) => ({
    name: oi.name,
    quantity: oi.quantity,
    unitPrice: Number(oi.unitPrice),
    taxRate: Number(oi.taxRate),
    hsn: oi.item.hsn ?? undefined,
    modifiers: oi.modifiers
      ? (oi.modifiers as Array<{ name: string; price: number }>)
      : undefined,
    notes: oi.notes ?? undefined,
  }));

  const outlet = {
    name: order.branch.name,
    addressLines: order.branch.address ? [order.branch.address] : undefined,
    phone: order.branch.phone ?? undefined,
    gstin: order.branch.gstin ?? undefined,
    stateCode: order.branch.stateCode ?? undefined,
  };

  if (fullInvoice) {
    // Full GST invoice (not implemented customer fetch yet, so minimal).
    const invoiceData: InvoiceData = {
      outlet,
      invoiceNumber: order.orderNumber,
      createdAt: order.createdAt,
      items,
      discountTotal: Number(order.discountTotal),
    };
    return invoiceData;
  }

  // Simple receipt.
  const receiptData: ReceiptData = {
    outlet,
    orderNumber: order.orderNumber,
    tableName: order.table?.name ?? undefined,
    createdAt: order.createdAt,
    items,
    discountTotal: Number(order.discountTotal),
    cashierName: order.createdBy?.name ?? undefined,
  };

  return receiptData;
}

// ─────────────────────────────────────────────────────────────
// Router
// ─────────────────────────────────────────────────────────────

export const printRouter = router({
  /** Print a KOT to the kitchen printer. Marks it printed on success. */
  printKot: roleProcedure("OWNER", "MANAGER", "CASHIER", "WAITER")
    .input(printKotSchema)
    .mutation(async ({ ctx, input }) => {
      const kotData = await fetchKotData(ctx, input.kotId, false);
      const payload = renderKot(kotData, { width: PRINTER_WIDTH as 58 | 80 });

      const queue = getQueue();
      try {
        await queue.enqueue({
          id: `kot-${input.kotId}`,
          payload,
          label: `KOT ${kotData.kotNumber}`,
        });
      } catch (err) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Print failed: ${err instanceof Error ? err.message : String(err)}`,
        });
      }

      // Mark printed (call the existing procedure via the db directly).
      await ctx.db.kot.update({
        where: { id: input.kotId },
        data: { printedAt: new Date() },
      });

      return { success: true, kotNumber: kotData.kotNumber };
    }),

  /** Reprint a KOT with a "REPRINT" flag so kitchen knows it's not new. */
  reprintKot: roleProcedure("OWNER", "MANAGER", "CASHIER", "WAITER", "KITCHEN")
    .input(reprintKotSchema)
    .mutation(async ({ ctx, input }) => {
      const kotData = await fetchKotData(ctx, input.kotId, true);
      const payload = renderKot(kotData, { width: PRINTER_WIDTH as 58 | 80 });

      const queue = getQueue();
      try {
        await queue.enqueue({
          id: `reprint-kot-${input.kotId}`,
          payload,
          label: `Reprint KOT ${kotData.kotNumber}`,
        });
      } catch (err) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Reprint failed: ${err instanceof Error ? err.message : String(err)}`,
        });
      }

      return { success: true, kotNumber: kotData.kotNumber };
    }),

  /** Print a bill (receipt or full GST invoice). */
  printBill: roleProcedure("OWNER", "MANAGER", "CASHIER")
    .input(printBillSchema)
    .mutation(async ({ ctx, input }) => {
      const data = await fetchOrderData(ctx, input.orderId, input.fullInvoice);
      const payload = input.fullInvoice
        ? renderInvoice(data as InvoiceData, { width: PRINTER_WIDTH as 58 | 80 })
        : renderReceipt(data as ReceiptData, { width: PRINTER_WIDTH as 58 | 80 });

      const queue = getQueue();
      try {
        await queue.enqueue({
          id: `bill-${input.orderId}`,
          payload,
          label: `Bill ${(data as ReceiptData).orderNumber}`,
        });
      } catch (err) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Print failed: ${err instanceof Error ? err.message : String(err)}`,
        });
      }

      return { success: true, orderNumber: (data as ReceiptData).orderNumber };
    }),

  /** Open the cash drawer (typically triggered at end of sale). */
  openCashDrawer: roleProcedure("OWNER", "MANAGER", "CASHIER")
    .input(openCashDrawerSchema)
    .mutation(async () => {
      const builder = new EscPosBuilder();
      builder.cashDrawer();
      const payload = builder.build();

      const queue = getQueue();
      try {
        await queue.enqueue({
          id: `drawer-${Date.now()}`,
          payload,
          label: "Open cash drawer",
        });
      } catch (err) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Cash drawer open failed: ${err instanceof Error ? err.message : String(err)}`,
        });
      }

      return { success: true };
    }),

  /** Discover available printers (USB + network). */
  listPrinters: roleProcedure("OWNER", "MANAGER")
    .input(z.object({}).strict())
    .query(async () => {
      // Network scan: probe a small set of typical IPs if env provided.
      const networkHosts = process.env.PRINTER_NETWORK_SCAN_HOSTS
        ? process.env.PRINTER_NETWORK_SCAN_HOSTS.split(",").map((h) => h.trim())
        : [];

      const printers = await discoverAll(
        networkHosts.length > 0
          ? { hosts: networkHosts, port: PRINTER_PORT }
          : undefined,
      );

      return printers;
    }),
});
