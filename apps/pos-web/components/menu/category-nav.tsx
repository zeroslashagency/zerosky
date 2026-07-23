"use client";

interface Category {
  id: string;
  name: string;
  items: unknown[];
}

interface CategoryNavProps {
  categories: Category[];
  selectedCategory: string | null;
  onSelectCategory: (categoryId: string | null) => void;
  allItemsCount: number;
}

export function CategoryNav({
  categories,
  selectedCategory,
  onSelectCategory,
  allItemsCount,
}: CategoryNavProps) {
  return (
    <div className="mb-6 overflow-x-auto">
      <div className="flex gap-2 min-w-max pb-2">
        {/* All Items */}
        <button
          onClick={() => onSelectCategory(null)}
          className={`px-4 py-2 rounded-full font-medium transition-colors whitespace-nowrap ${
            selectedCategory === null
              ? "bg-blue-600 text-white"
              : "bg-white text-gray-700 hover:bg-gray-100 border border-gray-300"
          }`}
        >
          All ({allItemsCount})
        </button>

        {/* Category Pills */}
        {categories.map((category) => (
          <button
            key={category.id}
            onClick={() => onSelectCategory(category.id)}
            className={`px-4 py-2 rounded-full font-medium transition-colors whitespace-nowrap ${
              selectedCategory === category.id
                ? "bg-blue-600 text-white"
                : "bg-white text-gray-700 hover:bg-gray-100 border border-gray-300"
            }`}
          >
            {category.name} ({category.items.length})
          </button>
        ))}
      </div>
    </div>
  );
}
