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

interface PartnerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  partner?: {
    id: string;
    name: string;
    email: string;
    phone?: string | null;
    type: "FRANCHISE" | "PARTNER" | "INVESTOR";
    /** Plain number: the partner router converts Prisma's Decimal at the API boundary. */
    revenueSharePercent: number;
  };
  onSuccess: () => void;
}

export function PartnerDialog({ open, onOpenChange, partner, onSuccess }: PartnerDialogProps) {
  const [formData, setFormData] = useState({
    name: partner?.name ?? "",
    email: partner?.email ?? "",
    phone: partner?.phone ?? "",
    type: (partner?.type ?? "FRANCHISE") as "FRANCHISE" | "PARTNER" | "INVESTOR",
    revenueSharePercent: partner?.revenueSharePercent ?? 0,
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const createPartner = trpc.partner.create.useMutation({
    onSuccess: () => {
      onSuccess();
      onOpenChange(false);
      resetForm();
    },
    onError: (error) => {
      setErrors({ submit: error.message });
    },
  });

  const updatePartner = trpc.partner.update.useMutation({
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
      email: "",
      phone: "",
      type: "FRANCHISE",
      revenueSharePercent: 0,
    });
    setErrors({});
  };

  const validate = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = "Name is required";
    }

    if (!formData.email.trim()) {
      newErrors.email = "Email is required";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = "Invalid email format";
    }

    if (formData.revenueSharePercent < 0 || formData.revenueSharePercent > 100) {
      newErrors.revenueSharePercent = "Revenue share must be between 0 and 100";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) {
      return;
    }

    if (partner) {
      updatePartner.mutate({
        id: partner.id,
        name: formData.name,
        phone: formData.phone || undefined,
        type: formData.type,
        revenueSharePercent: formData.revenueSharePercent,
      });
    } else {
      createPartner.mutate(formData);
    }
  };

  const handleClose = () => {
    onOpenChange(false);
    resetForm();
  };

  const isLoading = createPartner.isPending || updatePartner.isPending;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent size="lg" onClose={handleClose}>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{partner ? "Edit Partner" : "Add New Partner"}</DialogTitle>
            <DialogDescription>
              {partner
                ? "Update partner information and revenue share details."
                : "Create a new partnership with revenue sharing configuration."}
            </DialogDescription>
          </DialogHeader>

          <div className="p-6 space-y-4">
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

            {/* Email */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-foreground mb-1">
                Email <span className="text-destructive">*</span>
              </label>
              <input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full px-3 py-2 border border-input rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                disabled={isLoading || !!partner}
              />
              {errors.email && <p className="text-sm text-destructive mt-1">{errors.email}</p>}
            </div>

            {/* Phone */}
            <div>
              <label htmlFor="phone" className="block text-sm font-medium text-foreground mb-1">
                Phone
              </label>
              <input
                id="phone"
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="w-full px-3 py-2 border border-input rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                disabled={isLoading}
              />
            </div>

            {/* Type */}
            <div>
              <label htmlFor="type" className="block text-sm font-medium text-foreground mb-1">
                Partnership Type <span className="text-destructive">*</span>
              </label>
              <select
                id="type"
                value={formData.type}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    type: e.target.value as "FRANCHISE" | "PARTNER" | "INVESTOR",
                  })
                }
                className="w-full px-3 py-2 border border-input rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                disabled={isLoading}
              >
                <option value="FRANCHISE">Franchise</option>
                <option value="PARTNER">Partner</option>
                <option value="INVESTOR">Investor</option>
              </select>
            </div>

            {/* Revenue Share */}
            <div>
              <label
                htmlFor="revenueShare"
                className="block text-sm font-medium text-foreground mb-1"
              >
                Revenue Share Percentage <span className="text-destructive">*</span>
              </label>
              <div className="relative">
                <input
                  id="revenueShare"
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  value={formData.revenueSharePercent}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      revenueSharePercent: parseFloat(e.target.value) || 0,
                    })
                  }
                  className="w-full px-3 py-2 border border-input rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  disabled={isLoading}
                />
                <span className="absolute right-3 top-2 text-muted-foreground">%</span>
              </div>
              {errors.revenueSharePercent && (
                <p className="text-sm text-destructive mt-1">{errors.revenueSharePercent}</p>
              )}
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
              {isLoading ? "Saving..." : partner ? "Update Partner" : "Create Partner"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
