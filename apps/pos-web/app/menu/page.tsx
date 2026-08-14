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
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Loading menu...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 sm:p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header with Cart Button */}
        <div className="flex items-center justify-between gap-3 mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Menu</h1>
          <button onClick={() => setIsCartOpen(true)} className="relative flex min-h-[44px] shrink-0 items-center gap-2 rounded-lg bg-primary px-4 py-2.5 sm:px-6 sm:py-3 font-semibold text-primary-foreground hover:bg-primary/90 transition-colors">
            <ShoppingCart className="w-5 h-5" />
            <span className="hidden sm:inline">View Cart</span>
            <span className="sm:hidden">Cart</span>
            {totals.itemCount > 0 && (
              <span className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground w-6 h-6 rounded-full flex items-center justify-center text-sm font-bold">
                {totals.itemCount}
              </span>
            )}
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

        {/* Items Grid */}
        {filteredItems.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground text-lg">No items found</p>
            <button
              onClick={handleClearFilters}
              className="mt-4 text-primary hover:text-primary/80 underline"
            >
              Clear all filters
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 sm:gap-4">
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
