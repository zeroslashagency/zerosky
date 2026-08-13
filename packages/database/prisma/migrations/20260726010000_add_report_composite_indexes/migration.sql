-- CreateIndex (idempotent — 0_init already creates this in some branches)
CREATE INDEX IF NOT EXISTS "orders_branchId_status_idx" ON "orders"("branchId", "status");

-- RenameIndex (idempotent — older DBs used lower-case names)
ALTER INDEX IF EXISTS "orders_branchid_createdat_idx" RENAME TO "orders_branchId_createdAt_idx";

-- RenameIndex
ALTER INDEX IF EXISTS "payments_branchid_method_tenderedat_idx" RENAME TO "payments_branchId_method_tenderedAt_idx";

