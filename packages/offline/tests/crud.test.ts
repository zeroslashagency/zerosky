import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { OfflineStore } from "../src/crud";
import { SyncQueue } from "../src/queue";
import { createTestDb, type TestDb } from "./helpers/db";

let ctx: TestDb;
let store: OfflineStore;

interface TenantRow {
  id: string;
  name: string;
  slug: string;
  updatedAt: Date;
  [key: string]: unknown;
}

beforeEach(async () => {
  ctx = await createTestDb();
  store = new OfflineStore(ctx.db, new SyncQueue(ctx.db));
});

afterEach(async () => {
  await ctx.destroy();
});

describe("OfflineStore.model", () => {
  it("resolves a delegate by camel-cased model name", () => {
    expect(() => store.model("Tenant")).not.toThrow();
  });

  it("throws for an unknown model", () => {
    expect(() => store.model("Nope")).toThrow(/Unknown model delegate/);
  });
});

describe("OfflineRepository (offline-first CRUD)", () => {
  it("writes to the local mirror and enqueues a CREATE", async () => {
    const tenants = store.model<TenantRow>("Tenant");
    const created = await tenants.create({ name: "Acme", slug: "acme" });

    // Local read reflects the write immediately (works with no network).
    const found = await tenants.findById(created.id);
    expect(found?.name).toBe("Acme");

    // A matching mutation was queued for later upload.
    const pending = await store.queue.pending();
    expect(pending).toHaveLength(1);
    expect(pending[0]?.operation).toBe("CREATE");
    expect(pending[0]?.model).toBe("Tenant");
    expect(pending[0]?.recordId).toBe(created.id);
  });

  it("enqueues an UPDATE with the new snapshot", async () => {
    const tenants = store.model<TenantRow>("Tenant");
    const created = await tenants.create({ name: "Acme", slug: "acme" });
    const updated = await tenants.update(created.id, { name: "Acme Foods" });

    expect(updated.name).toBe("Acme Foods");
    const pending = await store.queue.pending();
    const updateMutation = pending.find((m) => m.operation === "UPDATE");
    expect(updateMutation?.payload?.name).toBe("Acme Foods");
  });

  it("enqueues a DELETE with no payload and removes the local row", async () => {
    const tenants = store.model<TenantRow>("Tenant");
    const created = await tenants.create({ name: "Acme", slug: "acme" });
    await tenants.delete(created.id);

    expect(await tenants.findById(created.id)).toBeNull();
    const pending = await store.queue.pending();
    const deleteMutation = pending.find((m) => m.operation === "DELETE");
    expect(deleteMutation).toBeDefined();
    expect(deleteMutation?.payload).toBeNull();
  });

  it("findMany reads from the local mirror", async () => {
    const tenants = store.model<TenantRow>("Tenant");
    await tenants.create({ name: "A", slug: "a" });
    await tenants.create({ name: "B", slug: "b" });
    const all = await tenants.findMany({ orderBy: { slug: "asc" } });
    expect(all.map((t) => t.slug)).toEqual(["a", "b"]);
  });

  it("supports an explicit delegate key override", async () => {
    const tenants = store.model<TenantRow>("Tenant", "tenant");
    const created = await tenants.create({ name: "Acme", slug: "acme" });
    expect(created.id).toBeTruthy();
  });
});
