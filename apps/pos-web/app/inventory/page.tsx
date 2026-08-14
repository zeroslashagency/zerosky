'use client';

import { trpc } from '@/lib/trpc';
import { useAuth } from '@/lib/auth-context';
import { Button } from '@zerosky/ui';
import { Plus, AlertTriangle, Package, Edit, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { InventoryDialog } from '@/components/inventory/inventory-dialog';

export default function InventoryPage() {
  const { user } = useAuth();
  const [showLowStock, setShowLowStock] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>();
  const [dialogOpen, setDialogOpen] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- InventoryDialog typed item; narrowed at call sites
  const [editingItem, setEditingItem] = useState<any>(null);
  const { data: items, isLoading, refetch } = trpc.inventory.list.useQuery({ tenantId: user?.tenantId || '', lowStock: showLowStock, category: selectedCategory });
  const { data: alerts } = trpc.inventory.lowStockAlerts.useQuery({ tenantId: user?.tenantId || '' });
  const adjustStock = trpc.inventory.adjustStock.useMutation({ onSuccess: () => refetch() });
  const deleteItem = trpc.inventory.delete.useMutation({ onSuccess: () => refetch() });
  const handleAddItem = () => { setEditingItem(null); setDialogOpen(true); };
  const handleEditItem = (item: typeof editingItem) => { setEditingItem(item); setDialogOpen(true); };
  if (isLoading) return <div className="bento-canvas min-h-[100dvh] p-6"><div className="mx-auto max-w-[1400px] space-y-4"><div className="h-8 w-40 shimmer rounded-xl" /><div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="bento-card h-24" />)}</div></div></div>;
  const categories = Array.from(new Set(items?.map((item) => item.category) || []));
  const handleQuickAdjust = (itemId: string, itemName: string, type: 'IN' | 'OUT') => {
    const quantity = prompt(`Enter quantity to ${type === 'IN' ? 'add' : 'remove'} for ${itemName}:`);
    if (quantity && !isNaN(Number(quantity))) adjustStock.mutate({ inventoryItemId: itemId, tenantId: user?.tenantId || '', type, quantity: Number(quantity), reason: `Quick ${type === 'IN' ? 'stock in' : 'stock out'}` });
  };
  return (
    <div className="bento-canvas min-h-[100dvh] p-4 sm:p-6">
      <div className="mx-auto max-w-[1400px]">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div><h1 className="text-4xl font-semibold tracking-tighter leading-none text-foreground md:text-5xl">Inventory</h1><p className="mt-2 max-w-[65ch] text-sm leading-relaxed text-muted-foreground">Track stock levels · low-stock alerts · valuation</p></div>
          <Button onClick={handleAddItem} className="rounded-full min-h-[44px] w-full sm:w-auto active:scale-[0.98] transition"><Plus strokeWidth={1.5} className="mr-2 h-4 w-4" /> Add Item</Button>
        </div>
        <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <div className="bento-card p-5"><p className="text-xs font-medium tracking-[0.14em] text-muted-foreground">TOTAL ITEMS</p><p className="mt-2 font-mono text-2xl font-semibold tracking-tight text-foreground">{items?.length || 0}</p></div>
          <div className="bento-card p-5"><p className="text-xs font-medium tracking-[0.14em] text-muted-foreground">LOW STOCK</p><p className="mt-2 font-mono text-2xl font-semibold tracking-tight text-destructive">{alerts?.length || 0}</p></div>
          <div className="bento-card p-5"><p className="text-xs font-medium tracking-[0.14em] text-muted-foreground">CATEGORIES</p><p className="mt-2 font-mono text-2xl font-semibold tracking-tight text-foreground">{categories.length}</p></div>
          <div className="bento-card p-5"><p className="text-xs font-medium tracking-[0.14em] text-muted-foreground">TOTAL VALUE</p><p className="mt-2 font-mono text-lg font-semibold tracking-tight text-foreground">₹{(items?.reduce((sum, item) => sum + item.currentStock * item.unitCost, 0) ?? 0).toFixed(2)}</p></div>
        </div>
        <div className="bento-card mt-6 p-3">
          <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0">
            <Button variant={showLowStock ? 'default' : 'outline'} onClick={() => setShowLowStock(!showLowStock)} className={showLowStock ? 'rounded-full bg-destructive hover:bg-destructive/90' : 'rounded-full'} size="sm"><AlertTriangle strokeWidth={1.5} className="mr-2 h-4 w-4" /> Low Stock ({alerts?.length || 0})</Button>
            <Button variant={!selectedCategory ? 'default' : 'outline'} onClick={() => setSelectedCategory(undefined)} size="sm" className="rounded-full">All</Button>
            {categories.map((category) => <Button key={category} variant={selectedCategory === category ? 'default' : 'outline'} onClick={() => setSelectedCategory(category)} size="sm" className="rounded-full">{category}</Button>)}
          </div>
        </div>
        <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {items?.map((item) => {
            const currentStock = item.currentStock; const minStock = item.minStockLevel; const isLowStock = currentStock <= minStock;
            const stockPercentage = item.maxStockLevel ? (currentStock / item.maxStockLevel) * 100 : 100;
            return (
              <div key={item.id} className={`bento-card p-5 ${isLowStock ? 'border-amber-200 dark:border-amber-800' : ''}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0"><h3 className="font-semibold tracking-tight text-foreground">{item.name}</h3><p className="text-xs tracking-wide text-muted-foreground">{item.category}{item.sku ? ` · ${item.sku}` : ''}</p></div>
                  <div className="flex gap-1 shrink-0"><Button variant="ghost" size="sm" className="h-8 w-8 p-0 rounded-full" onClick={() => handleEditItem(item)} aria-label="Edit"><Edit strokeWidth={1.5} className="h-4 w-4" /></Button><Button variant="ghost" size="sm" className="h-8 w-8 p-0 rounded-full text-destructive" onClick={() => { if (confirm(`Delete ${item.name}?`)) deleteItem.mutate({ id: item.id }); }} aria-label="Delete"><Trash2 strokeWidth={1.5} className="h-4 w-4" /></Button></div>
                </div>
                <dl className="mt-4 space-y-1.5 text-sm">
                  <div className="flex justify-between"><dt className="text-muted-foreground">Stock</dt><dd className={`font-mono font-semibold ${isLowStock ? 'text-amber-600 dark:text-amber-300' : 'text-emerald-700 dark:text-emerald-300'}`}>{currentStock} {item.unit}</dd></div>
                  <div className="flex justify-between"><dt className="text-muted-foreground">Min</dt><dd className="font-mono text-foreground">{minStock} {item.unit}</dd></div>
                  {item.maxStockLevel && <div className="flex justify-between"><dt className="text-muted-foreground">Max</dt><dd className="font-mono text-foreground">{String(item.maxStockLevel)} {item.unit}</dd></div>}
                  <div className="flex justify-between"><dt className="text-muted-foreground">Unit cost</dt><dd className="font-mono font-medium text-foreground">₹{String(item.unitCost)}</dd></div>
                  <div className="flex justify-between"><dt className="text-muted-foreground">Value</dt><dd className="font-mono font-semibold text-foreground">₹{(currentStock * item.unitCost).toFixed(2)}</dd></div>
                </dl>
                {item.maxStockLevel && <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted"><div className={`h-full rounded-full transition-all ${isLowStock ? 'bg-amber-500' : 'bg-emerald-500'}`} style={{ width: `${Math.min(stockPercentage, 100)}%` }} /></div>}
                {item.supplier && <p className="mt-3 text-xs text-muted-foreground">Supplier: {item.supplier.name}</p>}
                <div className="mt-4 flex gap-2"><Button size="sm" variant="outline" className="flex-1 rounded-full" onClick={() => handleQuickAdjust(item.id, item.name, 'IN')}>+ In</Button><Button size="sm" variant="outline" className="flex-1 rounded-full" onClick={() => handleQuickAdjust(item.id, item.name, 'OUT')}>− Out</Button></div>
                {isLowStock && <p className="mt-3 inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-800 dark:bg-amber-950 dark:text-amber-100"><AlertTriangle strokeWidth={1.5} className="h-3 w-3" /> Low stock</p>}
              </div>
            );
          })}
        </div>
        {items?.length === 0 && <div className="mx-auto mt-10 max-w-md rounded-[2.5rem] border border-dashed border-border bg-card/50 p-10 text-center"><Package strokeWidth={1.5} className="mx-auto mb-3 h-10 w-10 text-muted-foreground" /><p className="font-medium tracking-tight text-foreground">No inventory items</p><p className="mt-1 text-sm text-muted-foreground">Add your first item to get started.</p></div>}
        <InventoryDialog open={dialogOpen} onOpenChange={setDialogOpen} item={editingItem} tenantId={user?.tenantId || ''} onSuccess={refetch} />
      </div>
    </div>
  );
}
