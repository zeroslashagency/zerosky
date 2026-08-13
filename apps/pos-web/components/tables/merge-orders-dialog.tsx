'use client';

import { useState } from 'react';
import { trpc } from '@/lib/trpc';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@zerosky/ui';
import { Button } from '@/components/ui/button';
import { cn } from '@zerosky/ui';
import { Loader2, Merge } from 'lucide-react';

interface MergeOrdersDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  branchId: string;
}

interface OrderWithTable {
  id: string;
  orderNumber: string;
  tableId: string | null;
  tableName: string;
  grandTotal: number;
}

function rupees(value: number): string {
  return `₹${value.toFixed(2)}`;
}

export function MergeOrdersDialog({
  open,
  onOpenChange,
  branchId,
}: MergeOrdersDialogProps) {
  const [selectedOrderIds, setSelectedOrderIds] = useState<Set<string>>(new Set());
  const [primaryOrderId, setPrimaryOrderId] = useState<string | null>(null);
  const utils = trpc.useUtils();

  const { data: tables } = trpc.table.list.useQuery(
    { branchId },
    { enabled: open }
  );

  const { data: orders, isLoading } = trpc.order.list.useQuery(
    { branchId, limit: 100 },
    { enabled: open }
  );

  const merge = trpc.table.mergeOrders.useMutation({
    onSuccess: () => {
      utils.table.list.invalidate();
      utils.order.list.invalidate();
      onOpenChange(false);
      setSelectedOrderIds(new Set());
      setPrimaryOrderId(null);
    },
  });

  const liveOrders = orders?.filter(
    (o) => o.tableId && o.status !== 'PAID' && o.status !== 'CANCELLED'
  );

  const ordersWithTables: OrderWithTable[] =
    liveOrders?.map((order) => {
      const table = tables?.find((t) => t.id === order.tableId);
      return {
        id: order.id,
        orderNumber: order.orderNumber,
        tableId: order.tableId,
        tableName: table?.name ?? 'Unknown',
        grandTotal: Number(order.grandTotal),
      };
    }) ?? [];

  const toggleOrder = (orderId: string) => {
    const newSet = new Set(selectedOrderIds);
    if (newSet.has(orderId)) {
      newSet.delete(orderId);
      if (primaryOrderId === orderId) {
        setPrimaryOrderId(null);
      }
    } else {
      newSet.add(orderId);
      if (!primaryOrderId) {
        setPrimaryOrderId(orderId);
      }
    }
    setSelectedOrderIds(newSet);
  };

  const selectedOrders = ordersWithTables.filter((o) =>
    selectedOrderIds.has(o.id)
  );
  const combinedTotal = selectedOrders.reduce((sum, o) => sum + o.grandTotal, 0);

  const handleMerge = () => {
    if (selectedOrderIds.size < 2 || !primaryOrderId) return;
    merge.mutate({
      orderIds: Array.from(selectedOrderIds),
      primaryOrderId,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card text-card-foreground sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Merge Orders</DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Combine multiple table orders into one bill
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="py-8 text-center text-muted-foreground">
            <Loader2 className="mx-auto h-6 w-6 animate-spin" />
          </div>
        ) : !ordersWithTables || ordersWithTables.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border p-8 text-center">
            <p className="text-sm text-muted-foreground">
              No live orders available to merge
            </p>
          </div>
        ) : (
          <>
            <div className="space-y-4">
              <label className="text-card-foreground">
                Select orders to merge (minimum 2)
              </label>
              <div className="max-h-64 space-y-2 overflow-y-auto">
                {ordersWithTables.map((order) => {
                  const isSelected = selectedOrderIds.has(order.id);
                  const isPrimary = primaryOrderId === order.id;
                  return (
                    <div
                      key={order.id}
                      className={cn(
                        'flex items-center justify-between rounded-lg border-2 p-3 transition-all',
                        isSelected
                          ? 'border-primary bg-primary/10'
                          : 'border-border bg-muted hover:border-primary/50'
                      )}
                    >
                      <button
                        onClick={() => toggleOrder(order.id)}
                        className="flex flex-1 items-center gap-3 text-left"
                      >
                        <div
                          className={cn(
                            'h-5 w-5 rounded border-2 transition-colors',
                            isSelected
                              ? 'border-primary bg-primary'
                              : 'border-muted-foreground'
                          )}
                        >
                          {isSelected && (
                            <svg
                              className="h-full w-full text-primary-foreground"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={3}
                                d="M5 13l4 4L19 7"
                              />
                            </svg>
                          )}
                        </div>
                        <div className="flex-1">
                          <p className="font-mono font-bold text-card-foreground">
                            {order.orderNumber}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {order.tableName}
                          </p>
                        </div>
                        <p className="font-semibold text-card-foreground">
                          {rupees(order.grandTotal)}
                        </p>
                      </button>
                      {isSelected && selectedOrderIds.size > 1 && (
                        <button
                          onClick={() => setPrimaryOrderId(order.id)}
                          className={cn(
                            'ml-2 rounded px-2 py-1 text-xs font-semibold transition-colors',
                            isPrimary
                              ? 'bg-primary text-primary-foreground'
                              : 'bg-muted text-muted-foreground hover:bg-primary/20'
                          )}
                        >
                          {isPrimary ? 'Primary' : 'Set Primary'}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {selectedOrderIds.size >= 2 && (
              <div className="rounded-lg border border-border bg-muted p-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">
                    {selectedOrderIds.size} orders selected
                  </span>
                  <span className="font-bold text-card-foreground">
                    Combined total: {rupees(combinedTotal)}
                  </span>
                </div>
                {primaryOrderId && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    Primary order:{' '}
                    {
                      ordersWithTables.find((o) => o.id === primaryOrderId)
                        ?.orderNumber
                    }
                  </p>
                )}
              </div>
            )}
          </>
        )}

        {merge.error && (
          <div className="rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">
            {merge.error.message}
          </div>
        )}

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={merge.isPending}
          >
            Cancel
          </Button>
          <Button
            onClick={handleMerge}
            disabled={
              selectedOrderIds.size < 2 || !primaryOrderId || merge.isPending
            }
          >
            {merge.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Merging...
              </>
            ) : (
              <>
                <Merge className="mr-2 h-4 w-4" />
                Merge Orders
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
