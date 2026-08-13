"use client";

import { trpc } from "@/lib/trpc";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Plus, AlertTriangle, Package, TrendingDown, Edit, Trash2 } from "lucide-react";
import { useState } from "react";
import { InventoryDialog } from "@/components/inventory/inventory-dialog";

export default function InventoryPage() {
  const { user } = useAuth();
  const [showLowStock, setShowLowStock] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  
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

  const handleAddItem = () => {
    setEditingItem(null);
    setDialogOpen(true);
  };

  const handleEditItem = (item: any) => {
    setEditingItem(item);
    setDialogOpen(true);
  };
  
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-lg text-muted-foreground">Loading inventory...</div>
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
          <h1 className="text-3xl font-bold text-foreground">Inventory Management</h1>
          <p className="text-muted-foreground mt-1">Track and manage your stock levels</p>
        </div>
        <Button onClick={handleAddItem}>
          <Plus className="mr-2 h-4 w-4" />
          Add Item
        </Button>
      </div>
      
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-card rounded-lg shadow p-4 border border-border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Total Items</p>
              <p className="text-2xl font-bold text-card-foreground">{items?.length || 0}</p>
            </div>
            <Package className="h-10 w-10 text-primary opacity-50" />
          </div>
        </div>
        
        <div className="bg-card rounded-lg shadow p-4 border border-border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Low Stock Alerts</p>
              <p className="text-2xl font-bold text-destructive">{alerts?.length || 0}</p>
            </div>
            <AlertTriangle className="h-10 w-10 text-destructive opacity-50" />
          </div>
        </div>
        
        <div className="bg-card rounded-lg shadow p-4 border border-border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Categories</p>
              <p className="text-2xl font-bold text-card-foreground">{categories.length}</p>
            </div>
            <TrendingDown className="h-10 w-10 text-purple-600 dark:text-purple-400 opacity-50" />
          </div>
        </div>
        
        <div className="bg-card rounded-lg shadow p-4 border border-border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Total Value</p>
              <p className="text-2xl font-bold text-card-foreground">
                ₹{items?.reduce((sum, item) => 
                  sum + (item.currentStock * item.unitCost), 0
                ).toFixed(2)}
              </p>
            </div>
            <Package className="h-10 w-10 text-green-600 dark:text-green-400 opacity-50" />
          </div>
        </div>
      </div>
      
      {/* Filters */}
      <div className="bg-card rounded-lg shadow p-4 mb-6 border border-border">
        <div className="flex flex-wrap gap-2">
          <Button 
            variant={showLowStock ? "default" : "outline"}
            onClick={() => setShowLowStock(!showLowStock)}
            className={showLowStock ? "bg-destructive hover:bg-destructive/90" : ""}
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
          const currentStock = item.currentStock;
          const minStock = item.minStockLevel;
          const isLowStock = currentStock <= minStock;
          const stockPercentage = item.maxStockLevel 
            ? (currentStock / item.maxStockLevel) * 100 
            : 100;
          
          return (
            <div 
              key={item.id} 
              className={`bg-card rounded-lg shadow border p-4 hover:shadow-md transition-shadow ${
                isLowStock ? 'border-destructive/50 bg-destructive/5' : 'border-border'
              }`}
            >
              <div className="flex justify-between items-start mb-3">
                <div className="flex-1">
                  <h3 className="font-semibold text-lg text-card-foreground">{item.name}</h3>
                  <p className="text-sm text-muted-foreground">{item.category}</p>
                  {item.sku && (
                    <p className="text-xs text-muted-foreground mt-1">SKU: {item.sku}</p>
                  )}
                </div>
                <div className="flex gap-1">
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="h-8 w-8 p-0"
                    onClick={() => handleEditItem(item)}
                    title="Edit item"
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="h-8 w-8 p-0 text-destructive hover:text-destructive/80"
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
                  <span className="text-sm text-muted-foreground">Current Stock:</span>
                  <span className={`font-bold ${isLowStock ? 'text-amber-700 dark:text-amber-300' : 'text-green-700 dark:text-green-300'}`}>
                    {currentStock} {item.unit}
                  </span>
                </div>
                
                <div className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground">Min Level:</span>
                  <span className="text-foreground">{minStock} {item.unit}</span>
                </div>
                
                {item.maxStockLevel && (
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-muted-foreground">Max Level:</span>
                    <span className="text-foreground">{item.maxStockLevel.toString()} {item.unit}</span>
                  </div>
                )}
                
                <div className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground">Unit Cost:</span>
                  <span className="font-semibold text-foreground">₹{item.unitCost.toString()}</span>
                </div>
                
                <div className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground">Stock Value:</span>
                  <span className="font-semibold text-foreground">
                    ₹{(currentStock * item.unitCost).toFixed(2)}
                  </span>
                </div>
              </div>
              
              {/* Stock Progress Bar */}
              {item.maxStockLevel && (
                <div className="mb-3">
                  <div className="w-full bg-muted rounded-full h-2">
                    <div 
                      className={`h-2 rounded-full transition-all ${
                        isLowStock ? 'bg-amber-600 dark:bg-amber-400' : 'bg-green-600 dark:bg-green-400'
                      }`}
                      style={{ width: `${Math.min(stockPercentage, 100)}%` }}
                    />
                  </div>
                </div>
              )}
              
              {/* Supplier */}
              {item.supplier && (
                <div className="text-xs text-muted-foreground mb-3">
                  Supplier: {item.supplier.name}
                </div>
              )}
              
              {/* Actions */}
              <div className="flex gap-2">
                <Button 
                  size="sm" 
                  variant="outline" 
                  className="flex-1 text-green-700 dark:text-green-300 border-green-600 dark:border-green-400 hover:bg-green-50 dark:hover:bg-green-950"
                  onClick={() => handleQuickAdjust(item.id, item.name, 'IN')}
                >
                  + Stock In
                </Button>
                <Button 
                  size="sm" 
                  variant="outline" 
                  className="flex-1 text-red-700 dark:text-red-300 border-red-600 dark:border-red-400 hover:bg-red-50 dark:hover:bg-red-950"
                  onClick={() => handleQuickAdjust(item.id, item.name, 'OUT')}
                >
                  - Stock Out
                </Button>
              </div>
              
              {isLowStock && (
                <div className="mt-2 text-xs text-amber-700 dark:text-amber-300 font-semibold flex items-center gap-1">
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
          <Package className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
          <p className="text-foreground text-lg">No inventory items found</p>
          <p className="text-muted-foreground text-sm mt-2">Add your first item to get started</p>
        </div>
      )}

      <InventoryDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        item={editingItem}
        tenantId={user?.tenantId || ""}
        onSuccess={refetch}
      />
    </div>
  );
}
