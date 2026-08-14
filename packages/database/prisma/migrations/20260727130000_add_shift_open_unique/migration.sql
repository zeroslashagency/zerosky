-- Enforce at most one OPEN shift per branch (P0 invariant).
-- Spec: packages/database/prisma/schema.prisma:432-438 + plan a3e96ae3 hardening B.
CREATE UNIQUE INDEX IF NOT EXISTS "shifts_branch_open" ON "shifts"("branchId") WHERE "status" = 'OPEN';

-- Fix InventoryItem.sku: was global @unique, should be per-tenant @@unique([tenantId, sku])
-- so two tenants can both use SKU "RICE-001". Drop the global index first.
DROP INDEX IF EXISTS "inventory_items_sku_key";
CREATE UNIQUE INDEX IF NOT EXISTS "inventory_items_tenantId_sku_key" ON "inventory_items"("tenantId", "sku");
