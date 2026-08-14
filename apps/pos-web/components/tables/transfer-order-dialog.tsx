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
import { Button } from '@zerosky/ui';
import { cn } from '@zerosky/ui';
import { ArrowRight, Loader2 } from 'lucide-react';

interface TransferOrderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sourceTableId: string;
  sourceTableName: string;
  orderId: string;
  branchId: string;
}

export function TransferOrderDialog({
  open,
  onOpenChange,
  sourceTableId,
  sourceTableName,
  orderId,
  branchId,
}: TransferOrderDialogProps) {
  const [selectedTableId, setSelectedTableId] = useState<string | null>(null);
  const utils = trpc.useUtils();

  const { data: tables, isLoading } = trpc.table.list.useQuery(
    { branchId },
    { enabled: open }
  );

  const transfer = trpc.table.transferOrder.useMutation({
    onSuccess: () => {
      utils.table.list.invalidate();
      utils.order.list.invalidate();
      onOpenChange(false);
      setSelectedTableId(null);
    },
  });

  const availableTables = tables?.filter(
    (t) => t.state === 'AVAILABLE' && t.id !== sourceTableId
  );

  const handleTransfer = () => {
    if (!selectedTableId) return;
    transfer.mutate({
      orderId,
      fromTableId: sourceTableId,
      toTableId: selectedTableId,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card text-card-foreground sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Transfer Order</DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Move the live order from {sourceTableName} to another table
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="py-8 text-center text-muted-foreground">
            <Loader2 className="mx-auto h-6 w-6 animate-spin" />
          </div>
        ) : !availableTables || availableTables.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border p-8 text-center">
            <p className="text-sm text-muted-foreground">
              No available tables to transfer to
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <label className="text-card-foreground">Select destination table</label>
            <div className="grid grid-cols-3 gap-2">
              {availableTables.map((table) => (
                <button
                  key={table.id}
                  onClick={() => setSelectedTableId(table.id)}
                  className={cn(
                    'rounded-lg border-2 p-3 text-center transition-all',
                    selectedTableId === table.id
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border bg-muted text-muted-foreground hover:border-primary/50'
                  )}
                >
                  <p className="font-bold">{table.name}</p>
                  <p className="text-xs opacity-80">{table.seats} seats</p>
                </button>
              ))}
            </div>
          </div>
        )}

        {transfer.error && (
          <div className="rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">
            {transfer.error.message}
          </div>
        )}

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={transfer.isPending}
          >
            Cancel
          </Button>
          <Button
            onClick={handleTransfer}
            disabled={!selectedTableId || transfer.isPending}
          >
            {transfer.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Transferring...
              </>
            ) : (
              <>
                <ArrowRight className="mr-2 h-4 w-4" />
                Transfer
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
