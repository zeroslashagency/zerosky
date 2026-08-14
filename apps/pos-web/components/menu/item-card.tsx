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

function fallbackImageUrl(name: string): string {
  const n = name.toLowerCase();
  if (n.includes("paneer")) return "https://images.unsplash.com/photo-1565557623262-b51c2513a641?w=600&auto=format&fit=crop&q=60";
  if (n.includes("butter chicken")) return "https://images.unsplash.com/photo-1603894584373-5ac82b2ae398?w=600&auto=format&fit=crop&q=60";
  if (n.includes("dal makhani")) return "https://images.unsplash.com/photo-1546833999-b9f581a1996d?w=600&auto=format&fit=crop&q=60";
  if (n.includes("dal")) return "https://images.unsplash.com/photo-1546833999-b9f581a1996d?w=600&auto=format&fit=crop&q=60";
  if (n.includes("naan") || n.includes("roti") || n.includes("kulcha")) return "https://images.unsplash.com/photo-1603894584373-5ac82b2ae398?w=600&auto=format&fit=crop&q=60";
  if (n.includes("samosa")) return "https://images.unsplash.com/photo-1601050690597-df0568f70950?w=600&auto=format&fit=crop&q=60";
  if (n.includes("tikka") || n.includes("kebab") || n.includes("kebap")) return "https://images.unsplash.com/photo-1599487488170-d11ec9c172f0?w=600&auto=format&fit=crop&q=60";
  if (n.includes("biryani") || n.includes("pulao")) return "https://images.unsplash.com/photo-1589302168068-964664d93dc0?w=600&auto=format&fit=crop&q=60";
  if (n.includes("chai") || n.includes("tea")) return "https://images.unsplash.com/photo-1571934811356-5cc061b6821f?w=600&auto=format&fit=crop&q=60";
  if (n.includes("lime") || n.includes("soda") || n.includes("mojito")) return "https://images.unsplash.com/photo-1621263764928-df1444c5e859?w=600&auto=format&fit=crop&q=60";
  if (n.includes("coffee") || n.includes("cold coffee")) return "https://images.unsplash.com/photo-1461023058943-07fcbe16d735?w=600&auto=format&fit=crop&q=60";
  if (n.includes("lassi") || n.includes("mango")) return "https://images.unsplash.com/photo-1623065422902-30a2d299bbe4?w=600&auto=format&fit=crop&q=60";
  if (n.includes("gulab") || n.includes("jamun")) return "https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=600&auto=format&fit=crop&q=60";
  if (n.includes("kulfi") || n.includes("ice")) return "https://images.unsplash.com/photo-1488477181946-64290103bb53?w=600&auto=format&fit=crop&q=60";
  return `https://picsum.photos/seed/${encodeURIComponent(n.replace(/\s+/g, '-'))}/600/400`;
}

export function ItemCard({ item, onAddToCart }: ItemCardProps) {
  const price = typeof item.price === "number" ? item.price : parseFloat(item.price.toString());
  const taxRate = typeof item.taxRate === "number" ? item.taxRate : parseFloat(item.taxRate.toString());
  // related dish cover — imageUrl from DB else keyword fallback; on error retry with fallback so no grey blanks
  const primary = item.imageUrl || fallbackImageUrl(item.name);
  const fallback = fallbackImageUrl(item.name);

  const handleAddToCart = () => {
    onAddToCart(item);
  };

  return (
    <div
      className={`group bento-card !rounded-[20px] overflow-hidden p-0 transition-[transform,border-color] duration-200 hover:border-border cursor-pointer active:scale-[0.98] ${!item.isAvailable ? 'opacity-60' : ''}`}
      onClick={handleAddToCart}
    >
      {/* 20px radius on image area like div.mt-6.grid > div:nth-of-type(3) — soft gallery tile */}
      <div className="relative h-40 bg-muted overflow-hidden rounded-t-[20px]">
        {/* eslint-disable-next-line @next/next/no-img-element -- images.unsplash.com + picsum allowlisted */}
        <img src={primary} alt={item.name} loading="lazy" className="w-full h-full object-cover" onError={(e) => { const img = e.target as HTMLImageElement; if (img.src !== fallback) img.src = fallback; else img.style.display = 'none'; }} />

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
