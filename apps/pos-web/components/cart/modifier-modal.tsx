"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { useCart, type CartModifier, type ModifierOption } from "@/hooks/use-cart";

interface Modifier {
  id: string;
  name: string;
  price: number | string;
  isDefault: boolean;
  sortOrder: number;
}

interface ModifierGroup {
  id: string;
  name: string;
  minSelect: number;
  maxSelect: number;
  isRequired: boolean;
  sortOrder: number;
  modifiers: Modifier[];
}

interface MenuItem {
  id: string;
  name: string;
  description?: string | null;
  price: number | string | { toString: () => string };
  taxRate: number | string | { toString: () => string };
  isVeg: boolean;
  modifierGroups?: ModifierGroup[];
}

interface ModifierModalProps {
  item: MenuItem | null;
  isOpen: boolean;
  onClose: () => void;
}

export function ModifierModal({ item, isOpen, onClose }: ModifierModalProps) {
  const { addItem } = useCart();
  const [quantity, setQuantity] = useState(1);
  const [notes, setNotes] = useState("");
  // Map<groupId, Set<modifierId>>
  const [selections, setSelections] = useState<Map<string, Set<string>>>(new Map());

  if (!isOpen || !item) return null;

  const modifierGroups = item.modifierGroups || [];

  // If no modifier groups, add directly to cart
  if (modifierGroups.length === 0) {
    const price = typeof item.price === "number" ? item.price : parseFloat(item.price.toString());
    const taxRate = typeof item.taxRate === "number" ? item.taxRate : parseFloat(item.taxRate.toString());
    
    addItem({
      menuItemId: item.id,
      name: item.name,
      price,
      taxRate,
      quantity: 1,
      modifiers: [],
      notes: undefined,
      isVeg: item.isVeg,
    });
    onClose();
    return null;
  }

  // Initialize selections with defaults
  if (selections.size === 0) {
    const initialSelections = new Map<string, Set<string>>();
    modifierGroups.forEach((group) => {
      const defaults = group.modifiers.filter((m) => m.isDefault).map((m) => m.id);
      if (defaults.length > 0) {
        initialSelections.set(group.id, new Set(defaults));
      } else {
        initialSelections.set(group.id, new Set());
      }
    });
    setSelections(initialSelections);
  }

  const toggleModifier = (groupId: string, modifierId: string, group: ModifierGroup) => {
    setSelections((prev) => {
      const newSelections = new Map(prev);
      const groupSelections = new Set(newSelections.get(groupId) || []);

      if (groupSelections.has(modifierId)) {
        groupSelections.delete(modifierId);
      } else {
        // Single-select: clear others
        if (group.maxSelect === 1) {
          groupSelections.clear();
        }
        // Check max limit
        if (groupSelections.size < group.maxSelect) {
          groupSelections.add(modifierId);
        }
      }

      newSelections.set(groupId, groupSelections);
      return newSelections;
    });
  };

  const isSelectionValid = () => {
    for (const group of modifierGroups) {
      const selected = selections.get(group.id)?.size || 0;
      if (group.isRequired && selected < group.minSelect) {
        return false;
      }
    }
    return true;
  };

  const calculateTotal = () => {
    let total = typeof item.price === "number" ? item.price : parseFloat(item.price.toString());

    modifierGroups.forEach((group) => {
      const groupSelections = selections.get(group.id) || new Set();
      groupSelections.forEach((modifierId) => {
        const modifier = group.modifiers.find((m) => m.id === modifierId);
        if (modifier) {
          const modPrice = typeof modifier.price === "number" ? modifier.price : parseFloat(modifier.price.toString());
          total += modPrice;
        }
      });
    });

    return total * quantity;
  };

  const handleAddToCart = () => {
    const modifiers: CartModifier[] = [];

    modifierGroups.forEach((group) => {
      const groupSelections = selections.get(group.id) || new Set();
      if (groupSelections.size > 0) {
        const options: ModifierOption[] = [];
        groupSelections.forEach((modifierId) => {
          const modifier = group.modifiers.find((m) => m.id === modifierId);
          if (modifier) {
            options.push({
              id: modifier.id,
              name: modifier.name,
              price: typeof modifier.price === "number" ? modifier.price : parseFloat(modifier.price.toString()),
            });
          }
        });
        modifiers.push({
          groupId: group.id,
          groupName: group.name,
          options,
        });
      }
    });

    const price = typeof item.price === "number" ? item.price : parseFloat(item.price.toString());
    const taxRate = typeof item.taxRate === "number" ? item.taxRate : parseFloat(item.taxRate.toString());

    addItem({
      menuItemId: item.id,
      name: item.name,
      price,
      taxRate,
      quantity,
      modifiers,
      notes: notes.trim() || undefined,
      isVeg: item.isVeg,
    });

    // Reset and close
    setQuantity(1);
    setNotes("");
    setSelections(new Map());
    onClose();
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black bg-opacity-50 z-50"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="modifier-modal-title"
          className="bg-card rounded-lg shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto border border-border"
        >
          {/* Header */}
          <div className="sticky top-0 bg-card border-b border-border p-4 flex items-start justify-between">
            <div>
              <h2 id="modifier-modal-title" className="text-2xl font-bold text-card-foreground">{item.name}</h2>
              {item.description && (
                <p className="text-muted-foreground text-sm mt-1">{item.description}</p>
              )}
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-muted rounded-full transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* Content */}
          <div className="p-4 space-y-6">
            {/* Modifier Groups */}
            {modifierGroups.map((group) => {
              const groupSelections = selections.get(group.id) || new Set();
              const isSingleSelect = group.maxSelect === 1;

              return (
                <div key={group.id}>
                  <h3 className="font-semibold mb-3 text-card-foreground">
                    {group.name}
                    {group.isRequired && <span className="text-destructive ml-1">*</span>}
                    <span className="text-sm text-muted-foreground ml-2">
                      {isSingleSelect
                        ? "(Select One)"
                        : group.minSelect > 0
                        ? `(Select ${group.minSelect}-${group.maxSelect})`
                        : `(Optional, up to ${group.maxSelect})`}
                    </span>
                  </h3>

                  {isSingleSelect ? (
                    // Radio buttons for single-select
                    <div className="grid grid-cols-1 gap-3">
                      {group.modifiers.map((modifier) => {
                        const modPrice = typeof modifier.price === "number" ? modifier.price : parseFloat(modifier.price.toString());
                        return (
                          <button
                            key={modifier.id}
                            onClick={() => toggleModifier(group.id, modifier.id, group)}
                            className={`p-3 border-2 rounded-lg transition-colors text-left ${
                              groupSelections.has(modifier.id)
                                ? "border-primary bg-primary/10"
                                : "border-input hover:border-muted-foreground"
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-medium text-foreground">{modifier.name}</span>
                              {modPrice !== 0 && (
                                <span className="text-muted-foreground">
                                  {modPrice > 0 ? "+" : ""}₹{modPrice}
                                </span>
                              )}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    // Checkboxes for multi-select
                    <div className="space-y-2">
                      {group.modifiers.map((modifier) => {
                        const modPrice = typeof modifier.price === "number" ? modifier.price : parseFloat(modifier.price.toString());
                        return (
                          <label
                            key={modifier.id}
                            className="flex items-center justify-between p-3 border border-border rounded-lg cursor-pointer hover:bg-muted"
                          >
                            <div className="flex items-center gap-3">
                              <input
                                type="checkbox"
                                checked={groupSelections.has(modifier.id)}
                                onChange={() => toggleModifier(group.id, modifier.id, group)}
                                className="w-5 h-5 text-primary rounded"
                              />
                              <span className="font-medium text-foreground">{modifier.name}</span>
                            </div>
                            {modPrice > 0 && (
                              <span className="text-muted-foreground">+₹{modPrice}</span>
                            )}
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}

            {/* Special Instructions */}
            <div>
              <h3 className="font-semibold mb-3 text-card-foreground">Special Instructions</h3>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Any special requests? (e.g., less spicy, no onions)"
                className="w-full p-3 border border-input rounded-lg focus:ring-2 focus:ring-ring focus:border-transparent bg-background text-foreground"
                rows={3}
              />
            </div>

            {/* Quantity Selector */}
            <div>
              <h3 className="font-semibold mb-3 text-card-foreground">Quantity</h3>
              <div className="flex items-center gap-4">
                <button
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  className="w-10 h-10 border border-input rounded-lg hover:bg-muted"
                >
                  −
                </button>
                <span className="text-xl font-semibold w-12 text-center text-foreground">
                  {quantity}
                </span>
                <button
                  onClick={() => setQuantity(quantity + 1)}
                  className="w-10 h-10 border border-input rounded-lg hover:bg-muted"
                >
                  +
                </button>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="sticky bottom-0 bg-muted border-t border-border p-4">
            <button
              onClick={handleAddToCart}
              disabled={!isSelectionValid()}
              className="w-full bg-primary text-primary-foreground py-3 rounded-lg hover:bg-primary/90 transition-colors font-semibold text-lg flex items-center justify-between px-6 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span>Add to Cart</span>
              <span>₹{calculateTotal().toFixed(2)}</span>
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
