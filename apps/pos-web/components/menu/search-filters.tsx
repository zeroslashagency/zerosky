"use client";

interface SearchFiltersProps {
  searchTerm: string;
  onSearchChange: (value: string) => void;
  isVegOnly: boolean;
  onVegOnlyChange: (value: boolean) => void;
  priceRange: [number, number];
  onPriceRangeChange: (value: [number, number]) => void;
  availableOnly: boolean;
  onAvailableOnlyChange: (value: boolean) => void;
  onClearFilters: () => void;
  resultCount: number;
}

export function SearchFilters({
  searchTerm,
  onSearchChange,
  isVegOnly,
  onVegOnlyChange,
  priceRange,
  onPriceRangeChange,
  availableOnly,
  onAvailableOnlyChange,
  onClearFilters,
  resultCount,
}: SearchFiltersProps) {
  const hasActiveFilters =
    searchTerm !== "" ||
    isVegOnly ||
    priceRange[0] !== 0 ||
    priceRange[1] !== 2000 ||
    !availableOnly;

  return (
    <div className="bg-white rounded-lg shadow-md p-4 mb-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Search */}
        <div className="lg:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Search
          </label>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search by name or description..."
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        {/* Vegetarian Toggle */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Dietary
          </label>
          <label className="flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={isVegOnly}
              onChange={(e) => onVegOnlyChange(e.target.checked)}
              className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
            <span className="ml-2 text-gray-700">Vegetarian Only</span>
          </label>
        </div>

        {/* Availability Toggle */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Availability
          </label>
          <label className="flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={availableOnly}
              onChange={(e) => onAvailableOnlyChange(e.target.checked)}
              className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
            <span className="ml-2 text-gray-700">Available Only</span>
          </label>
        </div>
      </div>

      {/* Price Range Slider */}
      <div className="mt-4">
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Price Range: ₹{priceRange[0]} - ₹{priceRange[1]}
        </label>
        <div className="flex items-center gap-4">
          <input
            type="range"
            min="0"
            max="2000"
            step="50"
            value={priceRange[0]}
            onChange={(e) =>
              onPriceRangeChange([parseInt(e.target.value), priceRange[1]])
            }
            className="flex-1"
          />
          <input
            type="range"
            min="0"
            max="2000"
            step="50"
            value={priceRange[1]}
            onChange={(e) =>
              onPriceRangeChange([priceRange[0], parseInt(e.target.value)])
            }
            className="flex-1"
          />
        </div>
      </div>

      {/* Results and Clear */}
      <div className="mt-4 flex items-center justify-between">
        <p className="text-sm text-gray-600">
          Showing <span className="font-semibold">{resultCount}</span> items
        </p>
        {hasActiveFilters && (
          <button
            onClick={onClearFilters}
            className="text-sm text-blue-600 hover:text-blue-800 font-medium"
          >
            Clear all filters
          </button>
        )}
      </div>
    </div>
  );
}
