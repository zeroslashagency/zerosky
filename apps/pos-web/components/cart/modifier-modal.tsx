"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { useCart, type CartModifier, type ModifierOption } from "@/hooks/use-cart";

interface MenuItem {
  id: string;
  name: string;
  description?: string | null;
  price: number | string | { toString: () => string };
  taxRate: number | string | { toString: () => string };
  isVeg: boolean;
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
  const [selectedSize, setSelectedSize] = useState<string>("M");
  const [selectedAddons, setSelectedAddons] = useState<Set<string>>(new Set());

  if (!isOpen || !item) return null;

  // Mock modifier groups - in production these would come from the database
  const sizeOptions = [
    { id: "S", name: "Small", price: -20 },
    { id: "M", name: "Medium", price: 0 },
    { id: "L", name: "Large", price: 30 },
  ];

  const addonOptions = [
    { id: "extra-cheese", name: "Extra Cheese", price: 40 },
    { id: "extra-spice", name: "Extra Spice", price: 0 },
    { id: "less-oil", name: "Less Oil", price: 0 },
  ];

  const handleAddToCart = () => {
    const modifiers: CartModifier[] = [];

    // Add size modifier
    const sizeOption = sizeOptions.find((s) => s.id === selectedSize);
    if (sizeOption) {
      modifiers.push({
        groupId: "size",
        groupName: "Size",
        options: [sizeOption],
      });
    }

    // Add selected addons
    const selectedAddonOptions = addonOptions.filter((addon) =>
      selectedAddons.has(addon.id)
    );
    if (selectedAddonOptions.length > 0) {
      modifiers.push({
        groupId: "addons",
        groupName: "Add-ons",
        options: selectedAddonOptions,
      });
    }

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
    setSelectedSize("M");
    setSelectedAddons(new Set());
    onClose();
  };

  const toggleAddon = (addonId: string) => {
    setSelectedAddons((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(addonId)) {
        newSet.delete(addonId);
      } else {
        newSet.add(addonId);
      }
      return newSet;
    });
  };

  const calculateTotal = () => {
    let total = typeof item.price === "number" ? item.price : parseFloat(item.price.toString());
    
    const sizeOption = sizeOptions.find((s) => s.id === selectedSize);
    if (sizeOption) {
      total += sizeOption.price;
    }

    selectedAddons.forEach((addonId) => {
      const addon = addonOptions.find((a) => a.id === addonId);
      if (addon) {
        total += addon.price;
      }
    });

    return total * quantity;
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
        <div className="bg-white rounded-lg shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
          {/* Header */}
          <div className="sticky top-0 bg-white border-b p-4 flex items-start justify-between">
            <div>
              <h2 className="text-2xl font-bold">{item.name}</h2>
              {item.description && (
                <p className="text-gray-600 text-sm mt-1">{item.description}</p>
              )}
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* Content */}
          <div className="p-4 space-y-6">
            {/* Size Selection */}
            <div>
              <h3 className="font-semibold mb-3">Size (Select One)</h3>
              <div className="grid grid-cols-3 gap-3">
                {sizeOptions.map((size) => (
                  <button
                    key={size.id}
                    onClick={() => setSelectedSize(size.id)}
                    className={`p-3 border-2 rounded-lg transition-colors ${
                      selectedSize === size.id
                        ? "border-blue-600 bg-blue-50"
                        : "border-gray-300 hover:border-gray-400"
                    }`}
                  >
                    <div className="font-semibold">{size.name}</div>
                    {size.price !== 0 && (
                      <div className="text-sm text-gray-600">
                        {size.price > 0 ? "+" : ""}₹{size.price}
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Add-ons Selection */}
            <div>
              <h3 className="font-semibold mb-3">Add-ons (Optional)</h3>
              <div className="space-y-2">
                {addonOptions.map((addon) => (
                  <label
                    key={addon.id}
                    className="flex items-center justify-between p-3 border rounded-lg cursor-pointer hover:bg-gray-50"
                  >
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={selectedAddons.has(addon.id)}
                        onChange={() => toggleAddon(addon.id)}
                        className="w-5 h-5 text-blue-600 rounded"
                      />
                      <span className="font-medium">{addon.name}</span>
                    </div>
                    {addon.price > 0 && (
                      <span className="text-gray-600">+₹{addon.price}</span>
                    )}
                  </label>
                ))}
              </div>
            </div>

            {/* Special Instructions */}
            <div>
              <h3 className="font-semibold mb-3">Special Instructions</h3>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Any special requests? (e.g., less spicy, no onions)"
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                rows={3}
              />
            </div>

            {/* Quantity Selector */}
            <div>
              <h3 className="font-semibold mb-3">Quantity</h3>
              <div className="flex items-center gap-4">
                <button
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  className="w-10 h-10 border border-gray-300 rounded-lg hover:bg-gray-100"
                >
                  −
                </button>
                <span className="text-xl font-semibold w-12 text-center">
                  {quantity}
                </span>
                <button
                  onClick={() => setQuantity(quantity + 1)}
                  className="w-10 h-10 border border-gray-300 rounded-lg hover:bg-gray-100"
                >
                  +
                </button>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="sticky bottom-0 bg-gray-50 border-t p-4">
            <button
              onClick={handleAddToCart}
              className="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 transition-colors font-semibold text-lg flex items-center justify-between px-6"
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
