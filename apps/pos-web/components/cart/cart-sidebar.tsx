"use client";

import { useCart } from "@/hooks/use-cart";
import { X, Plus, Minus, Trash2, ShoppingCart } from "lucide-react";

interface CartSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  onCheckout: () => void;
}

export function CartSidebar({ isOpen, onClose, onCheckout }: CartSidebarProps) {
  const { items, updateQuantity, removeItem, clearCart, calculateTotals } = useCart();
  const totals = calculateTotals();

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black bg-opacity-50 z-40"
        onClick={onClose}
      />

      {/* Sidebar */}
      <div className="fixed right-0 top-0 h-full w-full md:w-96 bg-card shadow-xl z-50 flex flex-col border-l border-border">
        {/* Header */}
        <div className="p-4 border-b border-border flex items-center justify-between bg-muted">
          <h2 className="text-xl font-bold flex items-center gap-2 text-card-foreground">
            <ShoppingCart className="w-6 h-6" />
            Cart ({totals.itemCount})
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-background rounded-full transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Cart Items */}
        <div className="flex-1 overflow-y-auto p-4">
          {items.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <ShoppingCart className="w-16 h-16 mx-auto mb-4 opacity-50" />
              <p className="text-lg">Your cart is empty</p>
              <p className="text-sm mt-2">Add items from the menu to get started</p>
            </div>
          ) : (
            <div className="space-y-4">
              {items.map((item) => {
                const modifierPrice = item.modifiers.reduce(
                  (sum, mod) =>
                    sum + mod.options.reduce((s, opt) => s + opt.price, 0),
                  0
                );
                const itemTotal = (item.price + modifierPrice) * item.quantity;

                return (
                  <div
                    key={item.id}
                    className="bg-muted rounded-lg p-3 border border-border"
                  >
                    {/* Item Header */}
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <div
                            className={`w-4 h-4 border-2 flex items-center justify-center ${
                              item.isVeg ? "border-green-600" : "border-red-600"
                            }`}
                          >
                            <div
                              className={`w-1.5 h-1.5 rounded-full ${
                                item.isVeg ? "bg-green-600" : "bg-red-600"
                              }`}
                            />
                          </div>
                          <h3 className="font-semibold text-card-foreground">{item.name}</h3>
                        </div>

                        {/* Modifiers */}
                        {item.modifiers.length > 0 && (
                          <div className="mt-1 space-y-1">
                            {item.modifiers.map((modifier) => (
                              <div key={modifier.groupId} className="text-xs text-muted-foreground">
                                {modifier.options.map((opt) => (
                                  <span
                                    key={opt.id}
                                    className="inline-block bg-primary-100 text-primary-800 px-2 py-0.5 rounded mr-1 mb-1"
                                  >
                                    {opt.name}
                                    {opt.price > 0 && ` (+₹${opt.price})`}
                                  </span>
                                ))}
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Notes */}
                        {item.notes && (
                          <p className="text-xs text-muted-foreground mt-1 italic">
                            Note: {item.notes}
                          </p>
                        )}
                      </div>

                      {/* Remove Button */}
                      <button
                        onClick={() => removeItem(item.id)}
                        className="p-1 hover:bg-red-100 dark:hover:bg-red-950 rounded text-red-600 dark:text-red-400"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Quantity Controls and Price */}
                    <div className="flex items-center justify-between mt-3">
                      <div className="flex items-center gap-2 bg-background rounded border border-input">
                        <button
                          onClick={() => updateQuantity(item.id, item.quantity - 1)}
                          className="p-2 hover:bg-muted"
                        >
                          <Minus className="w-4 h-4" />
                        </button>
                        <span className="font-semibold w-8 text-center text-foreground">
                          {item.quantity}
                        </span>
                        <button
                          onClick={() => updateQuantity(item.id, item.quantity + 1)}
                          className="p-2 hover:bg-muted"
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                      </div>

                      <p className="font-bold text-lg text-card-foreground">₹{itemTotal.toFixed(2)}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer with Totals and Checkout */}
        {items.length > 0 && (
          <div className="border-t border-border bg-muted p-4">
            {/* Clear Cart */}
            <button
              onClick={clearCart}
              className="text-sm text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 mb-3 flex items-center gap-1"
            >
              <Trash2 className="w-4 h-4" />
              Clear Cart
            </button>

            {/* Totals */}
            <div className="space-y-2 mb-4">
              <div className="flex justify-between text-muted-foreground">
                <span>Subtotal</span>
                <span>₹{totals.subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>Tax (GST)</span>
                <span>₹{totals.tax.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-xl font-bold border-t border-border pt-2 text-card-foreground">
                <span>Total</span>
                <span>₹{totals.total.toFixed(2)}</span>
              </div>
            </div>

            {/* Checkout Button */}
            <button
              onClick={onCheckout}
              className="w-full bg-primary text-primary-foreground py-3 rounded-lg hover:bg-primary/90 transition-colors font-semibold text-lg"
            >
              Proceed to Checkout
            </button>
          </div>
        )}
      </div>
    </>
  );
}
