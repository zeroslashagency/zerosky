import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface ModifierOption {
  id: string;
  name: string;
  price: number;
}

export interface CartModifier {
  groupId: string;
  groupName: string;
  options: ModifierOption[];
}

export interface CartItem {
  id: string;
  menuItemId: string;
  name: string;
  price: number;
  taxRate: number;
  quantity: number;
  modifiers: CartModifier[];
  notes?: string;
  isVeg: boolean;
}

export interface CartTotals {
  subtotal: number;
  tax: number;
  total: number;
  itemCount: number;
}

interface CartState {
  items: CartItem[];
  addItem: (item: Omit<CartItem, "id">) => void;
  removeItem: (id: string) => void;
  updateQuantity: (id: string, quantity: number) => void;
  clearCart: () => void;
  calculateTotals: () => CartTotals;
}

export const useCart = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],

      addItem: (item) => {
        const id = `${item.menuItemId}-${Date.now()}-${Math.random()}`;
        set((state) => ({
          items: [...state.items, { ...item, id }],
        }));
      },

      removeItem: (id) => {
        set((state) => ({
          items: state.items.filter((item) => item.id !== id),
        }));
      },

      updateQuantity: (id, quantity) => {
        if (quantity <= 0) {
          get().removeItem(id);
          return;
        }
        set((state) => ({
          items: state.items.map((item) =>
            item.id === id ? { ...item, quantity } : item
          ),
        }));
      },

      clearCart: () => {
        set({ items: [] });
      },

      calculateTotals: () => {
        const items = get().items;
        
        let subtotal = 0;
        let tax = 0;

        items.forEach((item) => {
          // Base item price
          let itemPrice = item.price;

          // Add modifier prices
          item.modifiers.forEach((modifier) => {
            modifier.options.forEach((option) => {
              itemPrice += option.price;
            });
          });

          const itemTotal = itemPrice * item.quantity;
          const itemTax = (itemTotal * item.taxRate) / 100;

          subtotal += itemTotal;
          tax += itemTax;
        });

        return {
          subtotal: parseFloat(subtotal.toFixed(2)),
          tax: parseFloat(tax.toFixed(2)),
          total: parseFloat((subtotal + tax).toFixed(2)),
          itemCount: items.reduce((sum, item) => sum + item.quantity, 0),
        };
      },
    }),
    {
      name: "zerosky-cart",
    }
  )
);
