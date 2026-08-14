"use client";

interface MenuItem {
  id: string;
  name: string;
  description?: string | null;
  price: number | { toString: () => string };
  taxRate: number | { toString: () => string };
  isVeg: boolean;
  imageUrl?: string | null;
  isAvailable: boolean;
  categoryName?: string;
}

interface ItemCardProps {
  item: MenuItem;
  onAddToCart: (item: MenuItem) => void;
}

export function ItemCard({ item, onAddToCart }: ItemCardProps) {
  const price = typeof item.price === "number" ? item.price : parseFloat(item.price.toString());
  const taxRate = typeof item.taxRate === "number" ? item.taxRate : parseFloat(item.taxRate.toString());

  const handleAddToCart = () => {
    onAddToCart(item);
  };

  return (
    <div
      className={`group bento-card overflow-hidden p-0 transition-[transform,border-color] duration-200 hover:border-border cursor-pointer active:scale-[0.98] ${!item.isAvailable ? 'opacity-60' : ''}`}
      onClick={handleAddToCart}
    >
      {/* Image — varied ratio, no hover scale on mobile §5 */}
      <div className="relative h-40 bg-muted overflow-hidden">
        {item.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- external menu CDN, remotePatterns not yet allowlisted
          <img
            src={item.imageUrl}
            alt={item.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-muted-foreground">
            <svg
              className="w-16 h-16"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
          </div>
        )}

        {/* Badges */}
        <div className="absolute top-2 left-2 flex gap-1">
          {/* Veg/Non-Veg Badge */}
          <div
            className={`w-5 h-5 border-2 flex items-center justify-center ${
              item.isVeg ? "border-green-600" : "border-red-600"
            }`}
          >
            <div
              className={`w-2 h-2 rounded-full ${
                item.isVeg ? "bg-green-600" : "bg-red-600"
              }`}
            />
          </div>
        </div>

        {/* Availability Badge */}
        {!item.isAvailable && (
          <div className="absolute top-2 right-2 bg-red-600 text-white px-2 py-1 rounded text-xs font-semibold">
            Out of Stock
          </div>
        )}
      </div>

      {/* Content — price mono per §6 Density, label below */}
      <div className="p-4">
        <h3 className="line-clamp-1 text-sm font-semibold tracking-tight text-card-foreground">{item.name}</h3>
        {item.description && <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted-foreground">{item.description}</p>}
        <div className="mt-3 flex items-center justify-between">
          <div>
            <p className="font-mono text-sm font-semibold tracking-tight text-card-foreground">₹{price.toFixed(2)}</p>
            <p className="text-[11px] text-muted-foreground">GST {taxRate}%</p>
          </div>
          {item.isAvailable && (
            <button
              onClick={(e) => { e.stopPropagation(); handleAddToCart(); }}
              className="rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground transition hover:bg-primary/90 active:scale-[0.98]"
            >Add</button>
          )}
        </div>
      </div>
    </div>
  );
}
