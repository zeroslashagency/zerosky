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
import { Input } from '@zerosky/ui';
import { cn } from '@zerosky/ui';
import { Loader2, Split, Trash2, Plus } from 'lucide-react';

interface SplitBillDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orderId: string;
  orderNumber: string;
  grandTotal: number;
}

function rupees(value: number): string {
  return `₹${value.toFixed(2)}`;
}

export function SplitBillDialog({
  open,
  onOpenChange,
  orderId,
  orderNumber,
  grandTotal,
}: SplitBillDialogProps) {
  const [splitMode, setSplitMode] = useState<'amount' | 'seat'>('amount');
  const [amountParts, setAmountParts] = useState<number[]>([
    grandTotal / 2,
    grandTotal / 2,
  ]);
  const [splitResult, setSplitResult] = useState<any>(null);

  const splitQuery = trpc.payment.splitBill.useQuery(
    {
      orderId,
      method:
        splitMode === 'seat'
          ? { type: 'seat' }
          : { type: 'amount', parts: amountParts },
    },
    { enabled: false }
  );

  const handleSplit = async () => {
    const result = await splitQuery.refetch();
    if (result.data) {
      setSplitResult(result.data);
    }
  };

  const addPart = () => {
    const remaining = grandTotal - amountParts.reduce((a, b) => a + b, 0);
    setAmountParts([...amountParts, Math.max(0, remaining)]);
  };

  const removePart = (index: number) => {
    if (amountParts.length > 2) {
      setAmountParts(amountParts.filter((_, i) => i !== index));
    }
  };

  const updatePart = (index: number, value: string) => {
    const num = parseFloat(value) || 0;
    const newParts = [...amountParts];
    newParts[index] = num;
    setAmountParts(newParts);
  };

  const totalParts = amountParts.reduce((a, b) => a + b, 0);
  const mismatch = Math.abs(totalParts - grandTotal) > 0.01;

  const resetAndClose = () => {
    setSplitResult(null);
    setAmountParts([grandTotal / 2, grandTotal / 2]);
    onOpenChange(false);
  };

  if (splitResult) {
    return (
      <Dialog open={open} onOpenChange={resetAndClose}>
        <DialogContent className="bg-card text-card-foreground sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Split Bill — {orderNumber}</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Bill split into {splitResult.parts.length} parts
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            {splitResult.parts.map((part: any, index: number) => (
              <div
                key={index}
                className="rounded-lg border border-border bg-muted p-4"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-card-foreground">
                      Part {part.index ?? index + 1}
                      {part.seat !== undefined && ` (Seat ${part.seat})`}
                    </p>
                    {part.items && part.items.length > 0 && (
                      <p className="text-xs text-muted-foreground">
                        {part.items.join(', ')}
                      </p>
                    )}
                  </div>
                  <p className="text-lg font-bold text-card-foreground">
                    {rupees(part.amount)}
                  </p>
                </div>
              </div>
            ))}
          </div>

          <div className="rounded-lg border border-border bg-muted p-4">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Grand Total</span>
              <span className="font-bold text-card-foreground">
                {rupees(grandTotal)}
              </span>
            </div>
          </div>

          <DialogFooter>
            <Button onClick={resetAndClose}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={resetAndClose}>
      <DialogContent className="bg-card text-card-foreground sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Split Bill — {orderNumber}</DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Grand Total: {rupees(grandTotal)}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <label className="text-card-foreground">Split method</label>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <button
                onClick={() => setSplitMode('amount')}
                className={cn(
                  'rounded-lg border-2 p-3 text-sm font-semibold transition-all',
                  splitMode === 'amount'
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border bg-muted text-muted-foreground hover:border-primary/50'
                )}
              >
                By Amount
              </button>
              <button
                onClick={() => setSplitMode('seat')}
                className={cn(
                  'rounded-lg border-2 p-3 text-sm font-semibold transition-all',
                  splitMode === 'seat'
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border bg-muted text-muted-foreground hover:border-primary/50'
                )}
              >
                By Seat
              </button>
            </div>
          </div>

          {splitMode === 'amount' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-card-foreground">Amount per part</label>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={addPart}
                  className="h-8 gap-1"
                >
                  <Plus className="h-3 w-3" />
                  Add Part
                </Button>
              </div>
              {amountParts.map((amount, index) => (
                <div key={index} className="flex items-center gap-2">
                  <label className="w-16 text-sm text-muted-foreground">
                    Part {index + 1}
                  </label>
                  <Input
                    type="number"
                    step="0.01"
                    value={amount}
                    onChange={(e) => updatePart(index, e.target.value)}
                    className="flex-1 bg-background text-foreground"
                  />
                  {amountParts.length > 2 && (
                    <button
                      onClick={() => removePart(index)}
                      className="rounded p-2 text-destructive hover:bg-destructive/10"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              ))}
              <div className="rounded-lg border border-border bg-muted p-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Parts total</span>
                  <span
                    className={cn(
                      'font-bold',
                      mismatch ? 'text-destructive' : 'text-card-foreground'
                    )}
                  >
                    {rupees(totalParts)}
                  </span>
                </div>
                {mismatch && (
                  <p className="mt-1 text-xs text-destructive">
                    Parts must sum exactly to {rupees(grandTotal)}
                  </p>
                )}
              </div>
            </div>
          )}

          {splitMode === 'seat' && (
            <div className="rounded-lg border border-border bg-muted p-4 text-center text-sm text-muted-foreground">
              Bill will be split by seat assignments. Each seat's items and tax
              form one part.
            </div>
          )}
        </div>

        {splitQuery.error && (
          <div className="rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">
            {splitQuery.error.message}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={resetAndClose}>
            Cancel
          </Button>
          <Button
            onClick={handleSplit}
            disabled={
              splitQuery.isFetching ||
              (splitMode === 'amount' && mismatch)
            }
          >
            {splitQuery.isFetching ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Splitting...
              </>
            ) : (
              <>
                <Split className="mr-2 h-4 w-4" />
                Calculate Split
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
