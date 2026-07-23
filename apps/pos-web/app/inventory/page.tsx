"use client";

import { trpc } from "@/lib/trpc";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Plus, AlertTriangle, Package, TrendingDown, Edit, Trash2 } from "lucide-react";
import { useState } from "react";

export default function InventoryPage() {
  const { user } = useAuth();
  const [showLowStock, setShowLowStock] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>();
  
  const { data: items, isLoading, refetch } = trpc.inventory.list.useQuery({
    tenantId: user?.tenantId || "",
    lowStock: showLowStock,
    category: selectedCategory,
  });
  
  const { data: alerts } = trpc.inventory.lowStockAlerts.useQuery({
    tenantId: user?.tenantId || "",
  });
  
  const adjustStock = trpc.inventory.adjustStock.useMutation({
    onSuccess: () => {
      refetch();
    },
  });
  
  const deleteItem = trpc.inventory.delete.useMutation({
    onSuccess: () => {
      refetch();
    },
  });
  
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-lg">Loading inventory...</div>
      </div>
    );
  }
  
  // Get unique categories
  const categories = Array.from(new Set(items?.map(item => item.category) || []));
  
  const handleQuickAdjust = (itemId: string, itemName: string, type: 'IN' | 'OUT') => {
    const quantity = prompt(`Enter quantity to ${type === 'IN' ? 'add' : 'remove'} for ${itemName}:`);
    if (quantity && !isNaN(Number(quantity))) {
      adjustStock.mutate({
        inventoryItemId: itemId,
        tenantId: user?.tenantId || "",
        type,
        quantity: Number(quantity),
        reason: `Quick ${type === 'IN' ? 'stock in' : 'stock out'}`,
      });
    }
  };
  
  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold">Inventory Management</h1>
          <p className="text-gray-600 mt-1">Track and manage your stock levels</p>
        </div>
        <Button className="bg-blue-600 hover:bg-blue-700">
          <Plus className="mr-2 h-4 w-4" />
          Add Item
        </Button>
      </div>
      
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-lg shadow p-4 border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Items</p>
              <p className="text-2xl font-bold">{items?.length || 0}</p>
            </div>
            <Package className="h-10 w-10 text-blue-600 opacity-50" />
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow p-4 border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Low Stock Alerts</p>
              <p className="text-2xl font-bold text-red-600">{alerts?.length || 0}</p>
            </div>
            <AlertTriangle className="h-10 w-10 text-red-600 opacity-50" />
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow p-4 border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Categories</p>
              <p className="text-2xl font-bold">{categories.length}</p>
            </div>
            <TrendingDown className="h-10 w-10 text-purple-600 opacity-50" />
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow p-4 border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Value</p>
              <p className="text-2xl font-bold">
                ₹{items?.reduce((sum, item) => 
                  sum + (item.currentStock.toNumber() * item.unitCost.toNumber()), 0
                ).toFixed(2)}
              </p>
            </div>
            <Package className="h-10 w-10 text-green-600 opacity-50" />
          </div>
        </div>
      </div>
      
      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-4 mb-6 border">
        <div className="flex flex-wrap gap-2">
          <Button 
            variant={showLowStock ? "default" : "outline"}
            onClick={() => setShowLowStock(!showLowStock)}
            className={showLowStock ? "bg-red-600 hover:bg-red-700" : ""}
          >
            <AlertTriangle className="mr-2 h-4 w-4" />
            Low Stock ({alerts?.length || 0})
          </Button>
          
          <Button
            variant={!selectedCategory ? "default" : "outline"}
            onClick={() => setSelectedCategory(undefined)}
          >
            All Categories
          </Button>
          
          {categories.map((category) => (
            <Button
              key={category}
              variant={selectedCategory === category ? "default" : "outline"}
              onClick={() => setSelectedCategory(category)}
            >
              {category}
            </Button>
          ))}
        </div>
      </div>
      
      {/* Items Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {items?.map((item) => {
          const currentStock = item.currentStock.toNumber();
          const minStock = item.minStockLevel.toNumber();
          const isLowStock = currentStock <= minStock;
          const stockPercentage = item.maxStockLevel 
            ? (currentStock / item.maxStockLevel.toNumber()) * 100 
            : 100;
          
          return (
            <div 
              key={item.id} 
              className={`bg-white rounded-lg shadow border p-4 hover:shadow-md transition-shadow ${
                isLowStock ? 'border-red-300 bg-red-50' : ''
              }`}
            >
              <div className="flex justify-between items-start mb-3">
                <div className="flex-1">
                  <h3 className="font-semibold text-lg">{item.name}</h3>
                  <p className="text-sm text-gray-600">{item.category}</p>
                  {item.sku && (
                    <p className="text-xs text-gray-500 mt-1">SKU: {item.sku}</p>
                  )}
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="h-8 w-8 p-0 text-red-600 hover:text-red-700"
                    onClick={() => {
                      if (confirm(`Delete ${item.name}?`)) {
                        deleteItem.mutate({ id: item.id });
                      }
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              
              {/* Stock Info */}
              <div className="space-y-2 mb-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Current Stock:</span>
                  <span className={`font-bold ${isLowStock ? 'text-red-600' : 'text-green-600'}`}>
                    {currentStock} {item.unit}
                  </span>
                </div>
                
                <div className="flex justify-between items-center text-sm">
                  <span className="text-gray-600">Min Level:</span>
                  <span>{minStock} {item.unit}</span>
                </div>
                
                {item.maxStockLevel && (
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-600">Max Level:</span>
                    <span>{item.maxStockLevel.toString()} {item.unit}</span>
                  </div>
                )}
                
                <div className="flex justify-between items-center text-sm">
                  <span className="text-gray-600">Unit Cost:</span>
                  <span className="font-semibold">₹{item.unitCost.toString()}</span>
                </div>
                
                <div className="flex justify-between items-center text-sm">
                  <span className="text-gray-600">Stock Value:</span>
                  <span className="font-semibold">
                    ₹{(currentStock * item.unitCost.toNumber()).toFixed(2)}
                  </span>
                </div>
              </div>
              
              {/* Stock Progress Bar */}
              {item.maxStockLevel && (
                <div className="mb-3">
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className={`h-2 rounded-full transition-all ${
                        isLowStock ? 'bg-red-600' : 'bg-green-600'
                      }`}
                      style={{ width: `${Math.min(stockPercentage, 100)}%` }}
                    />
                  </div>
                </div>
              )}
              
              {/* Supplier */}
              {item.supplier && (
                <div className="text-xs text-gray-600 mb-3">
                  Supplier: {item.supplier.name}
                </div>
              )}
              
              {/* Actions */}
              <div className="flex gap-2">
                <Button 
                  size="sm" 
                  variant="outline" 
                  className="flex-1 text-green-600 border-green-600 hover:bg-green-50"
                  onClick={() => handleQuickAdjust(item.id, item.name, 'IN')}
                >
                  + Stock In
                </Button>
                <Button 
                  size="sm" 
                  variant="outline" 
                  className="flex-1 text-red-600 border-red-600 hover:bg-red-50"
                  onClick={() => handleQuickAdjust(item.id, item.name, 'OUT')}
                >
                  - Stock Out
                </Button>
              </div>
              
              {isLowStock && (
                <div className="mt-2 text-xs text-red-600 font-semibold flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" />
                  Low Stock Alert!
                </div>
              )}
            </div>
          );
        })}
      </div>
      
      {items?.length === 0 && (
        <div className="text-center py-12">
          <Package className="h-16 w-16 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600 text-lg">No inventory items found</p>
          <p className="text-gray-500 text-sm mt-2">Add your first item to get started</p>
        </div>
      )}
    </div>
  );
}
