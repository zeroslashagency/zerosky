// Tests for the branch and staff routers backing the management screens.
//
// staff.list must never expose credentials and must be restricted to management
// roles; branch.list must be tenant-scoped so one tenant cannot enumerate
// another's branches.

import { beforeAll, afterAll, describe, expect, it } from "vitest";
import { prisma } from "@zerosky/database";
import type { Branch, Tenant, User } from "@zerosky/database";
import { appRouter } from "../src/index.js";
import type { AuthUser, Context } from "../src/context.js";
import {
  createCallerFactory,
  setRateLimiter,
  createInMemoryRateLimiter,
} from "../src/trpc.js";

const createCaller = createCallerFactory(appRouter);

let tenant: Tenant;
let otherTenant: Tenant;
let branch: Branch;
let otherBranch: Branch;
let owner: User;
let waiter: User;

const uniq = () => Math.random().toString(36).slice(2, 10);

/** Build a caller authenticated as the given user. */
function callerFor(user: User, forTenant: Tenant) {
  const auth: AuthUser = { user, tenant: forTenant };
  const ctx: Context = {
    db: prisma,
    auth,
    requestId: `req-${uniq()}`,
    clientId: `bs-${uniq()}`,
  };
  return createCaller(ctx);
}

beforeAll(async () => {
  setRateLimiter(createInMemoryRateLimiter(100_000, 60_000));

  tenant = await prisma.tenant.create({
    data: { name: "BS Tenant", slug: `bs-${uniq()}` },
  });
  otherTenant = await prisma.tenant.create({
    data: { name: "BS Other", slug: `bso-${uniq()}` },
  });

  branch = await prisma.branch.create({
    data: { tenantId: tenant.id, name: "BS Main", code: `BSM-${uniq()}` },
  });
  otherBranch = await prisma.branch.create({
    data: { tenantId: otherTenant.id, name: "BS Foreign", code: `BSF-${uniq()}` },
  });

  owner = await prisma.user.create({
    data: {
      tenantId: tenant.id,
      email: `bs-owner-${uniq()}@t.com`,
      passwordHash: "irrelevant-for-these-tests",
      name: "BS Owner",
      role: "OWNER",
    },
  });
  waiter = await prisma.user.create({
    data: {
      tenantId: tenant.id,
      email: `bs-waiter-${uniq()}@t.com`,
      passwordHash: "irrelevant-for-these-tests",
      name: "BS Waiter",
      role: "WAITER",
    },
  });
});

afterAll(async () => {
  await prisma.tenant.deleteMany({
    where: { id: { in: [tenant.id, otherTenant.id] } },
  });
  await prisma.$disconnect();
});

describe("branch router", () => {
  it("lists only the caller's tenant branches", async () => {
    const caller = callerFor(owner, tenant);
    const branches = await caller.branch.list();

    const ids = branches.map((b) => b.id);
    expect(ids).toContain(branch.id);
    expect(ids).not.toContain(otherBranch.id);
  });

  it("refuses to fetch a branch belonging to another tenant", async () => {
    const caller = callerFor(owner, tenant);

    await expect(caller.branch.get({ id: otherBranch.id })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });

  it("fetches an own branch by id", async () => {
    const caller = callerFor(owner, tenant);
    const found = await caller.branch.get({ id: branch.id });
    expect(found.name).toBe("BS Main");
  });
});

describe("staff router", () => {
  it("returns staff for the caller's tenant only", async () => {
    const caller = callerFor(owner, tenant);
    const staff = await caller.staff.list();

    const emails = staff.map((s) => s.email);
    expect(emails).toContain(owner.email);
    expect(emails).toContain(waiter.email);
    expect(staff.every((s) => s.id !== undefined)).toBe(true);
  });

  it("never exposes password hashes or PINs", async () => {
    const caller = callerFor(owner, tenant);
    const staff = await caller.staff.list();

    for (const member of staff) {
      expect(member).not.toHaveProperty("passwordHash");
      expect(member).not.toHaveProperty("pin");
    }
    // Guard against a future `select` widening to include credentials.
    expect(JSON.stringify(staff)).not.toContain("passwordHash");
  });

  it("forbids non-management roles", async () => {
    const caller = callerFor(waiter, tenant);

    await expect(caller.staff.list()).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
