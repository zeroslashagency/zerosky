-- CreateIndex
CREATE INDEX "orders_branchId_status_idx" ON "orders"("branchId", "status");

-- RenameIndex
ALTER INDEX "orders_branchid_createdat_idx" RENAME TO "orders_branchId_createdAt_idx";

-- RenameIndex
ALTER INDEX "payments_branchid_method_tenderedat_idx" RENAME TO "payments_branchId_method_tenderedAt_idx";

