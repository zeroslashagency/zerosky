// Shift router: the cashier till / day lifecycle.
//
// A Shift is a countable drawer session. Every order and payment taken while it
// is open should point at it, so that closing the till can answer one question:
// does the cash in the drawer match what the system says should be there? The
// difference (variance) is snapshotted onto the row at close, because an owner
// reviewing yesterday's till must see the numbers as they were counted, not as
// a later edit would recompute them.
import { TRPCError } from "@trpc/server";
import { Prisma } from "@zerosky/database";
import type { Shift } from "@zerosky/database";
import { z } from "zod";
import { idSchema, moneySchema, paginationSchema } from "../schemas/common.js";
import { protectedProcedure, roleProcedure, router } from "../trpc.js";

// ─────────────────────────────────────────────────────────────
// Serialisation
// ─────────────────────────────────────────────────────────────

/**
 * Prisma hands money columns back as Decimal instances and superjson has no
 * serializer registered for that class, so the client receives a plain object
 * with no `.toNumber()` on it and calling one throws at render time. Convert at
 * the API boundary — same approach as `serializePartner` in partner.ts.
 */
function serializeShift<T extends Shift>(
  shift: T,
): Omit<T, "openingCash" | "closingCash" | "expectedCash" | "variance"> & {
  openingCash: number;
  closingCash: number | null;
  expectedCash: number | null;
  variance: number | null;
} {
  return {
    ...shift,
    openingCash: Number(shift.openingCash),
    closingCash: shift.closingCash === null ? null : Number(shift.closingCash),
    expectedCash:
      shift.expectedCash === null ? null : Number(shift.expectedCash),
    variance: shift.variance === null ? null : Number(shift.variance),
  };
}

// ─────────────────────────────────────────────────────────────
// Shared helpers
// ─────────────────────────────────────────────────────────────

/**
 * Minimal shape both `ctx.db` and an interactive transaction client satisfy for
 * the helpers below. Keeps `resolveOpenShift` callable from inside another
 * router's `$transaction` without importing the full PrismaClient type.
 */
type ShiftReader = Pick<Prisma.TransactionClient, "shift" | "payment">;

/**
 * The branch's currently open shift, or null when the till is closed.
 *
 * Exported so that `order.create` and `payment.record` can stamp `shiftId`
 * without duplicating the lookup. Deliberately returns null instead of throwing
 * so adopting it cannot break billing on a branch that has never opened a till.
 *
 *   const shift = await resolveOpenShift(tx, branch.id);
 *   // ...data: { ..., shiftId: shift?.id ?? null }
 */
export async function resolveOpenShift(
  db: ShiftReader,
  branchId: string,
): Promise<Shift | null> {
  return db.shift.findFirst({
    where: { branchId, status: "OPEN" },
    orderBy: { openedAt: "desc" },
  });
}

/**
 * Serialise till mutations for one branch inside the current transaction.
 *
 * The "exactly one open shift per branch" rule is a predicate, not a unique
 * column, so plain read-committed lets two simultaneous opens both see an empty
 * table and both insert. Serializable isolation would catch it, but it aborts
 * with P2034 whenever any other transaction touches the same index range —
 * unrelated branches included — which turns an unlucky moment into a failed
 * open. A transaction-scoped advisory lock keyed on the branch blocks only the
 * genuine contender and releases on commit or rollback.
 */
async function lockBranchTill(
  tx: Pick<Prisma.TransactionClient, "$executeRaw">,
  branchId: string,
): Promise<void> {
  // 8_741_001 is an arbitrary namespace so this lock cannot collide with an
  // advisory lock taken elsewhere in the app.
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(8741001, hashtext(${branchId}))`;
}

/** `shiftId` stamp for a new order/payment row on `branchId`. */
export async function shiftStamp(
  db: ShiftReader,
  branchId: string,
): Promise<{ shiftId: string | null }> {
  const shift = await resolveOpenShift(db, branchId);
  return { shiftId: shift?.id ?? null };
}

/**
 * What the system believes is in the drawer: the opening float, plus captured
 * cash taken during the shift, minus cash handed back as refunds. Summed in
 * PostgreSQL — a busy shift has hundreds of payments and none of them need to
 * cross the wire.
 */
async function computeExpectedCash(
  db: ShiftReader,
  shiftId: string,
  openingCash: Prisma.Decimal,
): Promise<{
  expectedCash: Prisma.Decimal;
  cashIn: Prisma.Decimal;
  cashRefunds: Prisma.Decimal;
}> {
  const [captured, refunded] = await Promise.all([
    db.payment.aggregate({
      where: { shiftId, method: "CASH", status: "CAPTURED" },
      _sum: { amount: true },
    }),
    db.payment.aggregate({
      where: { shiftId, method: "CASH", status: "REFUNDED" },
      _sum: { amount: true },
    }),
  ]);

  const cashIn = captured._sum.amount ?? new Prisma.Decimal(0);
  const cashRefunds = refunded._sum.amount ?? new Prisma.Decimal(0);

  return {
    expectedCash: openingCash.add(cashIn).sub(cashRefunds),
    cashIn,
    cashRefunds,
  };
}

/** Orders on this shift that are neither settled nor cancelled. */
async function countLiveOrders(
  db: Pick<Prisma.TransactionClient, "order">,
  shiftId: string,
): Promise<number> {
  return db.order.count({
    where: { shiftId, status: { notIn: ["PAID", "CANCELLED"] } },
  });
}

/** Short, human sentence explaining a variance. Rendered as-is by the UI. */
function explainVariance(variance: number): string {
  if (variance === 0) {
    return "Drawer matches the expected cash exactly.";
  }
  const magnitude = Math.abs(variance).toFixed(2);
  return variance > 0
    ? `Drawer is over by ₹${magnitude}. Check for an unrecorded cash sale or change not given.`
    : `Drawer is short by ₹${magnitude}. Check for a missed cash payment entry, an unlogged payout, or change given twice.`;
}

/** Aggregate the money numbers for one shift. Never loads order rows. */
async function summariseShift(
  db: Pick<Prisma.TransactionClient, "shift" | "order" | "payment">,
  shift: Shift,
) {
  const paidOrders = {
    shiftId: shift.id,
    status: "PAID" as const,
  };

  const [orderAgg, liveOrders, paymentGroups, cash] = await Promise.all([
    db.order.aggregate({
      where: paidOrders,
      _sum: {
        grandTotal: true,
        subtotal: true,
        taxTotal: true,
        discountTotal: true,
      },
      _count: true,
    }),
    countLiveOrders(db, shift.id),
    db.payment.groupBy({
      by: ["method"],
      where: { shiftId: shift.id, status: "CAPTURED" },
      _sum: { amount: true },
      _count: true,
    }),
    computeExpectedCash(db, shift.id, shift.openingCash),
  ]);

  const paymentBreakdown: Record<string, { amount: number; count: number }> =
    {};
  for (const group of paymentGroups) {
    paymentBreakdown[group.method] = {
      amount: Number(group._sum.amount ?? 0),
      count: group._count,
    };
  }

  // A closed shift reports the snapshot taken at close; an open one reports the
  // live figure so the cashier can see the drawer before committing to a count.
  const expectedCash =
    shift.status === "CLOSED" && shift.expectedCash !== null
      ? Number(shift.expectedCash)
      : Number(cash.expectedCash);
  const countedCash = shift.closingCash === null ? null : Number(shift.closingCash);
  const variance =
    shift.variance !== null
      ? Number(shift.variance)
      : countedCash === null
        ? null
        : countedCash - expectedCash;

  return {
    shift: serializeShift(shift),
    orderCount: orderAgg._count,
    liveOrderCount: liveOrders,
    grossSales: Number(orderAgg._sum.grandTotal ?? 0),
    netSales: Number(orderAgg._sum.subtotal ?? 0),
    taxTotal: Number(orderAgg._sum.taxTotal ?? 0),
    discountTotal: Number(orderAgg._sum.discountTotal ?? 0),
    paymentBreakdown,
    cashIn: Number(cash.cashIn),
    cashRefunds: Number(cash.cashRefunds),
    openingCash: Number(shift.openingCash),
    expectedCash,
    countedCash,
    variance,
    varianceExplanation: variance === null ? null : explainVariance(variance),
  };
}

// ─────────────────────────────────────────────────────────────
// Input schemas
// ─────────────────────────────────────────────────────────────

const openShiftSchema = z
  .object({
    branchId: idSchema,
    openingCash: moneySchema,
    notes: z.string().trim().max(500).optional(),
  })
  .strict();

const closeShiftSchema = z
  .object({
    branchId: idSchema,
    closingCash: moneySchema,
    notes: z.string().trim().max(500).optional(),
  })
  .strict();

const currentShiftSchema = z.object({ branchId: idSchema }).strict();

const shiftReportSchema = z.object({ shiftId: idSchema }).strict();

const listShiftsSchema = paginationSchema
  .extend({
    branchId: idSchema,
    status: z.enum(["OPEN", "CLOSED"]).optional(),
  })
  .strict();

// ─────────────────────────────────────────────────────────────
// Router
// ─────────────────────────────────────────────────────────────

export const shiftRouter = router({
  /**
   * Open the till. Rejected when the branch already has an open shift: two
   * drawers on one branch makes every cash number ambiguous. The check and the
   * insert share a transaction so two cashiers hitting the button at the same
   * moment cannot both win.
   */
  open: roleProcedure("OWNER", "MANAGER", "CASHIER")
    .input(openShiftSchema)
    .mutation(async ({ ctx, input }) => {
      const branch = await ctx.db.branch.findFirst({
        where: { id: input.branchId, tenantId: ctx.auth.tenant.id },
      });
      if (!branch) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Branch not found." });
      }

      const shift = await ctx.db.$transaction(async (tx) => {
        await lockBranchTill(tx, branch.id);

        const existing = await resolveOpenShift(tx, branch.id);
        if (existing) {
          throw new TRPCError({
            code: "CONFLICT",
            message:
              "A shift is already open for this branch. Close it before opening a new one.",
          });
        }

        return tx.shift.create({
          data: {
            branchId: branch.id,
            openedById: ctx.auth.user.id,
            status: "OPEN",
            openingCash: new Prisma.Decimal(input.openingCash),
            notes: input.notes,
          },
        });
      });

      return serializeShift(shift);
    }),

  /** The branch's open shift, or null. Polled by the POS shell. */
  current: protectedProcedure
    .input(currentShiftSchema)
    .query(async ({ ctx, input }) => {
      const shift = await ctx.db.shift.findFirst({
        where: {
          branchId: input.branchId,
          status: "OPEN",
          branch: { tenantId: ctx.auth.tenant.id },
        },
        orderBy: { openedAt: "desc" },
        include: {
          openedBy: { select: { id: true, name: true, role: true } },
        },
      });
      if (!shift) {
        return null;
      }
      const { openedBy, ...row } = shift;
      return { ...serializeShift(row), openedBy };
    }),

  /**
   * Close the till against a physical count. Snapshots expectedCash and the
   * variance so later payment edits cannot rewrite what was counted.
   */
  close: roleProcedure("OWNER", "MANAGER", "CASHIER")
    .input(closeShiftSchema)
    .mutation(async ({ ctx, input }) => {
      const branch = await ctx.db.branch.findFirst({
        where: { id: input.branchId, tenantId: ctx.auth.tenant.id },
      });
      if (!branch) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Branch not found." });
      }

      const closed = await ctx.db.$transaction(async (tx) => {
        // Same lock as open: two cashiers closing at once would otherwise both
        // snapshot expectedCash and the second write would win silently.
        await lockBranchTill(tx, branch.id);

        const shift = await resolveOpenShift(tx, branch.id);
        if (!shift) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "No shift is open for this branch.",
          });
        }

        // Unsettled orders would land their cash in the next shift while their
        // sale belongs to this one. Make the operator resolve them first.
        const live = await countLiveOrders(tx, shift.id);
        if (live > 0) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `Cannot close: ${live} order${live === 1 ? "" : "s"} still open on this shift. Settle or cancel them first.`,
          });
        }

        const { expectedCash } = await computeExpectedCash(
          tx,
          shift.id,
          shift.openingCash,
        );
        const closingCash = new Prisma.Decimal(input.closingCash);
        const variance = closingCash.sub(expectedCash);

        return tx.shift.update({
          where: { id: shift.id },
          data: {
            status: "CLOSED",
            closedById: ctx.auth.user.id,
            closingCash,
            expectedCash,
            variance,
            closedAt: new Date(),
            notes: input.notes ?? shift.notes,
          },
        });
      });

      const result = serializeShift(closed);
      return {
        ...result,
        varianceExplanation: explainVariance(result.variance ?? 0),
      };
    }),

  /**
   * Money summary for one shift. Aggregated in PostgreSQL (same approach as
   * reports.salesSummary) so a long shift costs the same as a short one.
   */
  summary: protectedProcedure
    .input(shiftReportSchema)
    .query(async ({ ctx, input }) => {
      const shift = await ctx.db.shift.findFirst({
        where: { id: input.shiftId, branch: { tenantId: ctx.auth.tenant.id } },
      });
      if (!shift) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Shift not found." });
      }
      return summariseShift(ctx.db, shift);
    }),

  /** Printable end-of-shift report: the summary plus who ran the till. */
  report: protectedProcedure
    .input(shiftReportSchema)
    .query(async ({ ctx, input }) => {
      const shift = await ctx.db.shift.findFirst({
        where: { id: input.shiftId, branch: { tenantId: ctx.auth.tenant.id } },
        include: {
          branch: { select: { id: true, name: true, code: true } },
          openedBy: { select: { id: true, name: true, role: true } },
          closedBy: { select: { id: true, name: true, role: true } },
        },
      });
      if (!shift) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Shift not found." });
      }

      const { branch, openedBy, closedBy, ...row } = shift;
      const summary = await summariseShift(ctx.db, row);
      return { ...summary, branch, openedBy, closedBy };
    }),

  /** Recent shifts for a branch, newest first — variance history for an owner. */
  list: protectedProcedure
    .input(listShiftsSchema)
    .query(async ({ ctx, input }) => {
      const shifts = await ctx.db.shift.findMany({
        where: {
          branchId: input.branchId,
          branch: { tenantId: ctx.auth.tenant.id },
          ...(input.status ? { status: input.status } : {}),
        },
        include: {
          openedBy: { select: { id: true, name: true } },
          closedBy: { select: { id: true, name: true } },
        },
        orderBy: { openedAt: "desc" },
        take: input.limit + 1,
        ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
      });

      const hasMore = shifts.length > input.limit;
      const page = hasMore ? shifts.slice(0, input.limit) : shifts;

      return {
        shifts: page.map(({ openedBy, closedBy, ...row }) => ({
          ...serializeShift(row),
          openedBy,
          closedBy,
        })),
        nextCursor: hasMore ? page[page.length - 1]?.id : undefined,
      };
    }),
});
