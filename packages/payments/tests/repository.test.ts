import { describe, expect, it, vi } from "vitest";
import { PrismaPaymentRepository } from "../src/repository.js";
import type { prisma as PrismaClientType } from "@zerosky/database";

/**
 * Minimal fake of the Prisma client's `payment` delegate. We only implement the
 * methods the repository uses, and return rows with a Decimal-like `amount`
 * (object with toString) to exercise the decimal coercion path.
 */
function createFakeDb(overrides: Record<string, unknown> = {}) {
  const decimal = (n: number) => ({ toString: () => String(n) });
  return {
    payment: {
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({
        id: "pay_db_1",
        branchId: data.branchId,
        orderId: data.orderId,
        method: data.method,
        status: data.status ?? "PENDING",
        amount: decimal(data.amount as number),
        reference: data.reference ?? null,
      })),
      findUnique: vi.fn(async ({ where }: { where: { id: string } }) =>
        where.id === "missing"
          ? null
          : {
              id: where.id,
              branchId: "b1",
              orderId: "o1",
              method: "CARD",
              status: "CAPTURED",
              amount: decimal(100),
              reference: "order_1",
            },
      ),
      findMany: vi.fn(async () => [
        {
          id: "pay_db_2",
          branchId: "b1",
          orderId: "o1",
          method: "UPI",
          status: "PENDING",
          amount: decimal(50),
          reference: "order_2",
        },
      ]),
      update: vi.fn(
        async ({
          where,
          data,
        }: {
          where: { id: string };
          data: Record<string, unknown>;
        }) => ({
          id: where.id,
          branchId: "b1",
          orderId: "o1",
          method: "CARD",
          status: data.status,
          amount: decimal(100),
          reference: data.reference ?? "order_1",
        }),
      ),
      ...overrides,
    },
  } as unknown as typeof PrismaClientType;
}

describe("PrismaPaymentRepository", () => {
  it("creates a payment and coerces the Decimal amount", async () => {
    const db = createFakeDb();
    const repo = new PrismaPaymentRepository(db);
    const record = await repo.create({
      branchId: "b1",
      orderId: "o1",
      method: "CARD",
      amount: 100,
      reference: "order_1",
    });
    expect(record.id).toBe("pay_db_1");
    expect(record.amount).toBe(100);
    expect(typeof record.amount).toBe("number");
  });

  it("finds a payment by id", async () => {
    const repo = new PrismaPaymentRepository(createFakeDb());
    const record = await repo.findById("pay_x");
    expect(record?.status).toBe("CAPTURED");
    expect(record?.amount).toBe(100);
  });

  it("returns null for a missing id", async () => {
    const repo = new PrismaPaymentRepository(createFakeDb());
    expect(await repo.findById("missing")).toBeNull();
  });

  it("finds payments by order id", async () => {
    const repo = new PrismaPaymentRepository(createFakeDb());
    const rows = await repo.findByOrderId("o1");
    expect(rows).toHaveLength(1);
    expect(rows[0]?.amount).toBe(50);
  });

  it("finds payments by reference", async () => {
    const repo = new PrismaPaymentRepository(createFakeDb());
    const rows = await repo.findByReference("order_2");
    expect(rows[0]?.reference).toBe("order_2");
  });

  it("updates status with a reference", async () => {
    const repo = new PrismaPaymentRepository(createFakeDb());
    const updated = await repo.updateStatus("pay_1", "REFUNDED", "pay_gw");
    expect(updated.status).toBe("REFUNDED");
    expect(updated.reference).toBe("pay_gw");
  });

  it("updates status without touching reference", async () => {
    const db = createFakeDb();
    const repo = new PrismaPaymentRepository(db);
    await repo.updateStatus("pay_1", "CAPTURED");
    const updateMock = db.payment.update as unknown as ReturnType<typeof vi.fn>;
    expect(updateMock).toHaveBeenCalledWith({
      where: { id: "pay_1" },
      data: { status: "CAPTURED" },
    });
  });
});
