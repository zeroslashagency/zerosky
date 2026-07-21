// @zerosky/payments — persistence boundary
// A narrow repository interface over the Prisma `Payment` model. The flows
// depend on this interface (not on Prisma directly) so tests can inject an
// in-memory fake and CI never needs a live database.

import { prisma } from "@zerosky/database";
import type { PaymentMethod, PaymentStatus } from "./types.js";

/** A persisted payment row, in the shape the payments package cares about. */
export interface PaymentRecord {
  id: string;
  branchId: string;
  orderId: string;
  method: PaymentMethod;
  status: PaymentStatus;
  /** Amount in rupees. */
  amount: number;
  reference: string | null;
}

/** Input for creating a new payment row. */
export interface CreatePaymentInput {
  branchId: string;
  orderId: string;
  method: PaymentMethod;
  amount: number;
  status?: PaymentStatus;
  reference?: string | null;
}

/** Storage operations the payment flows require. */
export interface PaymentRepository {
  create(input: CreatePaymentInput): Promise<PaymentRecord>;
  findById(id: string): Promise<PaymentRecord | null>;
  findByOrderId(orderId: string): Promise<PaymentRecord[]>;
  /** Find payments whose `reference` matches (e.g. a gateway order id). */
  findByReference(reference: string): Promise<PaymentRecord[]>;
  updateStatus(
    id: string,
    status: PaymentStatus,
    reference?: string | null,
  ): Promise<PaymentRecord>;
}

/** Coerce a Prisma Decimal (or number/string) to a JS number in rupees. */
function decimalToNumber(value: unknown): number {
  if (typeof value === "number") return value;
  if (typeof value === "string") return Number(value);
  // Prisma.Decimal exposes toString(); fall back to that.
  return Number(String(value));
}

interface PrismaPaymentRow {
  id: string;
  branchId: string;
  orderId: string;
  method: PaymentMethod;
  status: PaymentStatus;
  amount: unknown;
  reference: string | null;
}

function toRecord(row: PrismaPaymentRow): PaymentRecord {
  return {
    id: row.id,
    branchId: row.branchId,
    orderId: row.orderId,
    method: row.method,
    status: row.status,
    amount: decimalToNumber(row.amount),
    reference: row.reference,
  };
}

/** Prisma-backed implementation of {@link PaymentRepository}. */
export class PrismaPaymentRepository implements PaymentRepository {
  private readonly db: typeof prisma;

  constructor(db: typeof prisma = prisma) {
    this.db = db;
  }

  async create(input: CreatePaymentInput): Promise<PaymentRecord> {
    const row = await this.db.payment.create({
      data: {
        branchId: input.branchId,
        orderId: input.orderId,
        method: input.method,
        amount: input.amount,
        status: input.status ?? "PENDING",
        reference: input.reference ?? null,
      },
    });
    return toRecord(row as unknown as PrismaPaymentRow);
  }

  async findById(id: string): Promise<PaymentRecord | null> {
    const row = await this.db.payment.findUnique({ where: { id } });
    return row ? toRecord(row as unknown as PrismaPaymentRow) : null;
  }

  async findByOrderId(orderId: string): Promise<PaymentRecord[]> {
    const rows = await this.db.payment.findMany({ where: { orderId } });
    return rows.map((row) => toRecord(row as unknown as PrismaPaymentRow));
  }

  async findByReference(reference: string): Promise<PaymentRecord[]> {
    const rows = await this.db.payment.findMany({ where: { reference } });
    return rows.map((row) => toRecord(row as unknown as PrismaPaymentRow));
  }

  async updateStatus(
    id: string,
    status: PaymentStatus,
    reference?: string | null,
  ): Promise<PaymentRecord> {
    const row = await this.db.payment.update({
      where: { id },
      data: {
        status,
        ...(reference === undefined ? {} : { reference }),
      },
    });
    return toRecord(row as unknown as PrismaPaymentRow);
  }
}
