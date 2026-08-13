"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@zerosky/ui";

interface InventoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item?: {
    id: string;
    name: string;
    sku?: string | null;
    category: string;
    unit: string;
    /* Plain numbers: the inventory router converts Prisma's Decimal at the API boundary. */
    currentStock: number;
    minStockLevel: number;
    maxStockLevel?: number | null;
    reorderPoint?: number | null;
    unitCost: number;
    supplierId?: string | null;
  };
  tenantId: string;
  onSuccess: () => void;
}

export function InventoryDialog({
  open,
  onOpenChange,
  item,
  tenantId,
  onSuccess,
}: InventoryDialogProps) {
  const [formData, setFormData] = useState({
    name: item?.name ?? "",
    sku: item?.sku ?? "",
    category: item?.category ?? "",
    unit: item?.unit ?? "",
    currentStock: item?.currentStock ?? 0,
    minStockLevel: item?.minStockLevel ?? 0,
    maxStockLevel: item?.maxStockLevel ?? undefined,
    reorderPoint: item?.reorderPoint ?? undefined,
    unitCost: item?.unitCost ?? 0,
    supplierId: item?.supplierId ?? undefined,
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const { data: suppliers } = trpc.supplier.list.useQuery({
    tenantId,
    isActive: true,
  });

  const createItem = trpc.inventory.create.useMutation({
    onSuccess: () => {
      onSuccess();
      onOpenChange(false);
      resetForm();
    },
    onError: (error) => {
      setErrors({ submit: error.message });
    },
  });

  const updateItem = trpc.inventory.update.useMutation({
    onSuccess: () => {
      onSuccess();
      onOpenChange(false);
      resetForm();
    },
    onError: (error) => {
      setErrors({ submit: error.message });
    },
  });

  const resetForm = () => {
    setFormData({
      name: "",
      sku: "",
      category: "",
      unit: "",
      currentStock: 0,
      minStockLevel: 0,
      maxStockLevel: undefined,
      reorderPoint: undefined,
      unitCost: 0,
      supplierId: undefined,
    });
    setErrors({});
  };

  const validate = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = "Name is required";
    }

    if (!formData.category.trim()) {
      newErrors.category = "Category is required";
    }

    if (!formData.unit.trim()) {
      newErrors.unit = "Unit is required";
    }

    if (formData.currentStock < 0) {
      newErrors.currentStock = "Current stock cannot be negative";
    }

    if (formData.minStockLevel < 0) {
      newErrors.minStockLevel = "Min stock level cannot be negative";
    }

    if (formData.maxStockLevel !== undefined && formData.maxStockLevel < formData.minStockLevel) {
      newErrors.maxStockLevel = "Max stock level must be greater than min level";
    }

    if (formData.unitCost < 0) {
      newErrors.unitCost = "Unit cost cannot be negative";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) {
      return;
    }

    if (item) {
      updateItem.mutate({
        id: item.id,
        name: formData.name,
        category: formData.category,
        unit: formData.unit,
        minStockLevel: formData.minStockLevel,
        maxStockLevel: formData.maxStockLevel,
        reorderPoint: formData.reorderPoint,
        unitCost: formData.unitCost,
        supplierId: formData.supplierId,
      });
    } else {
      createItem.mutate({
        tenantId,
        name: formData.name,
        sku: formData.sku || undefined,
        category: formData.category,
        unit: formData.unit,
        currentStock: formData.currentStock,
        minStockLevel: formData.minStockLevel,
        maxStockLevel: formData.maxStockLevel,
        reorderPoint: formData.reorderPoint,
        unitCost: formData.unitCost,
        supplierId: formData.supplierId,
      });
    }
  };

  const handleClose = () => {
    onOpenChange(false);
    resetForm();
  };

  const isLoading = createItem.isPending || updateItem.isPending;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent size="xl" onClose={handleClose}>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{item ? "Edit Inventory Item" : "Add New Item"}</DialogTitle>
            <DialogDescription>
              {item ? "Update inventory item details." : "Add a new item to your inventory."}
            </DialogDescription>
          </DialogHeader>

          <div className="p-6 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              {/* Name */}
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-foreground mb-1">
                  Name <span className="text-destructive">*</span>
                </label>
                <input
                  id="name"
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-input rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  disabled={isLoading}
                />
                {errors.name && <p className="text-sm text-destructive mt-1">{errors.name}</p>}
              </div>

              {/* SKU */}
              <div>
                <label htmlFor="sku" className="block text-sm font-medium text-foreground mb-1">
                  SKU
                </label>
                <input
                  id="sku"
                  type="text"
                  value={formData.sku}
                  onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                  className="w-full px-3 py-2 border border-input rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  disabled={isLoading || !!item}
                />
              </div>

              {/* Category */}
              <div>
                <label
                  htmlFor="category"
                  className="block text-sm font-medium text-foreground mb-1"
                >
                  Category <span className="text-destructive">*</span>
                </label>
                <input
                  id="category"
                  type="text"
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  className="w-full px-3 py-2 border border-input rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  disabled={isLoading}
                  placeholder="e.g. Beverages, Ingredients, Supplies"
                />
                {errors.category && (
                  <p className="text-sm text-destructive mt-1">{errors.category}</p>
                )}
              </div>

              {/* Unit */}
              <div>
                <label htmlFor="unit" className="block text-sm font-medium text-foreground mb-1">
                  Unit <span className="text-destructive">*</span>
                </label>
                <input
                  id="unit"
                  type="text"
                  value={formData.unit}
                  onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                  className="w-full px-3 py-2 border border-input rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  disabled={isLoading}
                  placeholder="e.g. kg, liters, pieces"
                />
                {errors.unit && <p className="text-sm text-destructive mt-1">{errors.unit}</p>}
              </div>

              {/* Current Stock (only for new items) */}
              {!item && (
                <div>
                  <label
                    htmlFor="currentStock"
                    className="block text-sm font-medium text-foreground mb-1"
                  >
                    Current Stock <span className="text-destructive">*</span>
                  </label>
                  <input
                    id="currentStock"
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.currentStock}
                    onChange={(e) =>
                      setFormData({ ...formData, currentStock: parseFloat(e.target.value) || 0 })
                    }
                    className="w-full px-3 py-2 border border-input rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                    disabled={isLoading}
                  />
                  {errors.currentStock && (
                    <p className="text-sm text-destructive mt-1">{errors.currentStock}</p>
                  )}
                </div>
              )}

              {/* Min Stock Level */}
              <div>
                <label
                  htmlFor="minStockLevel"
                  className="block text-sm font-medium text-foreground mb-1"
                >
                  Min Stock Level <span className="text-destructive">*</span>
                </label>
                <input
                  id="minStockLevel"
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.minStockLevel}
                  onChange={(e) =>
                    setFormData({ ...formData, minStockLevel: parseFloat(e.target.value) || 0 })
                  }
                  className="w-full px-3 py-2 border border-input rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  disabled={isLoading}
                />
                {errors.minStockLevel && (
                  <p className="text-sm text-destructive mt-1">{errors.minStockLevel}</p>
                )}
              </div>

              {/* Max Stock Level */}
              <div>
                <label
                  htmlFor="maxStockLevel"
                  className="block text-sm font-medium text-foreground mb-1"
                >
                  Max Stock Level
                </label>
                <input
                  id="maxStockLevel"
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.maxStockLevel ?? ""}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      maxStockLevel: e.target.value ? parseFloat(e.target.value) : undefined,
                    })
                  }
                  className="w-full px-3 py-2 border border-input rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  disabled={isLoading}
                />
                {errors.maxStockLevel && (
                  <p className="text-sm text-destructive mt-1">{errors.maxStockLevel}</p>
                )}
              </div>

              {/* Reorder Point */}
              <div>
                <label
                  htmlFor="reorderPoint"
                  className="block text-sm font-medium text-foreground mb-1"
                >
                  Reorder Point
                </label>
                <input
                  id="reorderPoint"
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.reorderPoint ?? ""}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      reorderPoint: e.target.value ? parseFloat(e.target.value) : undefined,
                    })
                  }
                  className="w-full px-3 py-2 border border-input rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  disabled={isLoading}
                />
              </div>

              {/* Unit Cost */}
              <div>
                <label
                  htmlFor="unitCost"
                  className="block text-sm font-medium text-foreground mb-1"
                >
                  Unit Cost (₹) <span className="text-destructive">*</span>
                </label>
                <input
                  id="unitCost"
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.unitCost}
                  onChange={(e) =>
                    setFormData({ ...formData, unitCost: parseFloat(e.target.value) || 0 })
                  }
                  className="w-full px-3 py-2 border border-input rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  disabled={isLoading}
                />
                {errors.unitCost && (
                  <p className="text-sm text-destructive mt-1">{errors.unitCost}</p>
                )}
              </div>

              {/* Supplier */}
              <div>
                <label
                  htmlFor="supplierId"
                  className="block text-sm font-medium text-foreground mb-1"
                >
                  Supplier
                </label>
                <select
                  id="supplierId"
                  value={formData.supplierId ?? ""}
                  onChange={(e) =>
                    setFormData({ ...formData, supplierId: e.target.value || undefined })
                  }
                  className="w-full px-3 py-2 border border-input rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  disabled={isLoading}
                >
                  <option value="">No supplier</option>
                  {suppliers?.map((supplier) => (
                    <option key={supplier.id} value={supplier.id}>
                      {supplier.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {errors.submit && (
              <div className="p-3 rounded-md bg-destructive/10 border border-destructive/20 text-destructive text-sm">
                {errors.submit}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleClose} disabled={isLoading}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? "Saving..." : item ? "Update Item" : "Create Item"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
