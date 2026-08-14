"use client";

import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { CategoryNav } from "@/components/menu/category-nav";
import { ItemCard } from "@/components/menu/item-card";
import { SearchFilters } from "@/components/menu/search-filters";
import dynamic from "next/dynamic";
const CartSidebar = dynamic(() => import("@/components/cart/cart-sidebar").then((m) => m.CartSidebar), { ssr: false });
const ModifierModal = dynamic(() => import("@/components/cart/modifier-modal").then((m) => m.ModifierModal), { ssr: false });
import { useDebounce } from "@/hooks/use-debounce";
import { useCart } from "@/hooks/use-cart";
import { useRouter } from "next/navigation";
import { ShoppingCart } from "lucide-react";

export default function MenuPage() {
  const router = useRouter();
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [isVegOnly, setIsVegOnly] = useState(false);
  const [priceRange, setPriceRange] = useState<[number, number]>([0, 2000]);
  const [availableOnly, setAvailableOnly] = useState(true);
  const [isCartOpen, setIsCartOpen] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- ModifierModal typed via tRPC item union; narrowed at call site
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [isModifierModalOpen, setIsModifierModalOpen] = useState(false);

  const debouncedSearch = useDebounce(searchTerm, 300);
  const { calculateTotals } = useCart();
  const totals = calculateTotals();

  // Fetch menus with categories and items
  const { data: menus, isLoading: menusLoading } = trpc.menu.list.useQuery({
    includeInactive: false,
  });

  // Extract all categories and items
  const { categories, allItems } = useMemo(() => {
    if (!menus || menus.length === 0) {
      return { categories: [], allItems: [] };
    }

    const defaultMenu = menus.find((m) => m.isDefault) || menus[0];
    const cats = defaultMenu?.categories || [];
    const items = cats.flatMap((cat) =>
      cat.items.map((item) => ({
        ...item,
        categoryName: cat.name,
        categoryId: cat.id,
      }))
    );

    return { categories: cats, allItems: items };
  }, [menus]);

  // Filter items based on all criteria
  const filteredItems = useMemo(() => {
    let filtered = [...allItems];

    // Category filter
    if (selectedCategory) {
      filtered = filtered.filter((item) => item.categoryId === selectedCategory);
    }

    // Search filter
    if (debouncedSearch) {
      const search = debouncedSearch.toLowerCase();
      filtered = filtered.filter(
        (item) =>
          item.name.toLowerCase().includes(search) ||
          item.description?.toLowerCase().includes(search)
      );
    }

    // Vegetarian filter
    if (isVegOnly) {
      filtered = filtered.filter((item) => item.isVeg);
    }

    // Price range filter
    filtered = filtered.filter((item) => {
      const price = Number(item.price);
      return price >= priceRange[0] && price <= priceRange[1];
    });

    // Availability filter
    if (availableOnly) {
      filtered = filtered.filter((item) => item.isAvailable);
    }

    return filtered;
  }, [allItems, selectedCategory, debouncedSearch, isVegOnly, priceRange, availableOnly]);

  const handleClearFilters = () => {
    setSelectedCategory(null);
    setSearchTerm("");
    setIsVegOnly(false);
    setPriceRange([0, 2000]);
    setAvailableOnly(true);
  };

  const handleItemClick = (item: typeof selectedItem) => {
    setSelectedItem(item);
    setIsModifierModalOpen(true);
  };

  const handleCheckout = () => {
    setIsCartOpen(false);
    router.push("/orders/create");
  };

  if (menusLoading) {
    return (
      <div className="bento-canvas min-h-[100dvh] p-4 sm:p-6">
        <div className="mx-auto max-w-[1400px] space-y-4">
          <div className="h-8 w-24 shimmer rounded-xl" />
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="bento-card h-56 p-0 overflow-hidden"><div className="h-28 shimmer" /><div className="p-4 space-y-2"><div className="h-4 w-3/4 shimmer rounded" /><div className="h-3 w-1/2 shimmer rounded" /></div></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bento-canvas min-h-[100dvh] p-4 sm:p-6">
      <div className="mx-auto max-w-[1400px]">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-4xl font-semibold tracking-tighter leading-none text-foreground md:text-5xl">Menu</h1>
            <p className="mt-2 max-w-[65ch] text-sm leading-relaxed text-muted-foreground">{filteredItems.length} items · {categories.length} categories</p>
          </div>
          <button onClick={() => setIsCartOpen(true)} className="relative flex min-h-[44px] shrink-0 items-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground shadow-sm hover:bg-primary/90 active:scale-[0.98] transition">
            <ShoppingCart strokeWidth={1.5} className="h-5 w-5" />
            <span className="hidden sm:inline">Cart</span>
            {totals.itemCount > 0 && <span className="absolute -right-1 -top-1 flex h-6 w-6 items-center justify-center rounded-full bg-amber-500 text-xs font-bold text-white">{totals.itemCount}</span>}
          </button>
        </div>

        {/* Search and Filters */}
        <SearchFilters
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
          isVegOnly={isVegOnly}
          onVegOnlyChange={setIsVegOnly}
          priceRange={priceRange}
          onPriceRangeChange={setPriceRange}
          availableOnly={availableOnly}
          onAvailableOnlyChange={setAvailableOnly}
          onClearFilters={handleClearFilters}
          resultCount={filteredItems.length}
        />

        {/* Category Navigation */}
        <CategoryNav
          categories={categories}
          selectedCategory={selectedCategory}
          onSelectCategory={setSelectedCategory}
          allItemsCount={allItems.length}
        />

        {filteredItems.length === 0 ? (
          <div className="mx-auto mt-12 max-w-md rounded-[2.5rem] border border-dashed border-border bg-card/50 p-10 text-center">
            <p className="font-medium tracking-tight text-foreground">No items found</p>
            <p className="mt-1 text-sm text-muted-foreground">Try another search or category.</p>
            <button onClick={handleClearFilters} className="mt-4 text-sm font-medium text-primary hover:text-primary/80">Clear filters →</button>
          </div>
        ) : (
          <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
            {filteredItems.map((item) => (
              <ItemCard key={item.id} item={item} onAddToCart={handleItemClick} />
            ))}
          </div>
        )}
      </div>

      {/* Cart Sidebar */}
      <CartSidebar
        isOpen={isCartOpen}
        onClose={() => setIsCartOpen(false)}
        onCheckout={handleCheckout}
      />

      {/* Modifier Modal */}
      <ModifierModal
        item={selectedItem}
        isOpen={isModifierModalOpen}
        onClose={() => setIsModifierModalOpen(false)}
      />
    </div>
  );
}
