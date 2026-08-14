'use client';

import { useState } from 'react';
import { AlertTriangle, CheckCircle2, Lock, X } from 'lucide-react';
import { trpc } from '@/lib/trpc';
import { Button } from '@zerosky/ui';
import { formatMoney } from '@/components/shift/money';

interface CloseShiftDialogProps {
  open: boolean;
  branchId: string;
  /** Live expected drawer from shift.summary — what the system thinks is there. */
  expectedCash: number;
  liveOrderCount: number;
  onOpenChange: (open: boolean) => void;
  onClosed: () => void;
}

/**
 * Two-step close: the cashier types the counted cash and sees the variance
 * before confirming. Showing the number only after the shift is closed is how
 * tills end up with an unexplained ₹300 hole nobody noticed until payroll.
 */
export function CloseShiftDialog({
  open,
  branchId,
  expectedCash,
  liveOrderCount,
  onOpenChange,
  onClosed,
}: CloseShiftDialogProps) {
  const [countedCash, setCountedCash] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);

  const closeShift = trpc.shift.close.useMutation({
    onSuccess: () => {
      setCountedCash('');
      setNotes('');
      setError(null);
      onOpenChange(false);
      onClosed();
    },
    onError: (err) => setError(err.message),
  });

  if (!open) {
    return null;
  }

  const parsed = Number(countedCash);
  const counted = Number.isFinite(parsed) ? parsed : 0;
  const entered = countedCash !== '' && Number.isFinite(parsed) && parsed >= 0;
  const variance = Math.round((counted - expectedCash) * 100) / 100;
  const blocked = liveOrderCount > 0;

  const reset = () => {
    setError(null);
    onOpenChange(false);
  };

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!entered) {
      setError('Enter the cash you counted in the drawer.');
      return;
    }
    setError(null);
    closeShift.mutate({
      branchId,
      closingCash: Math.round(counted * 100) / 100,
      ...(notes.trim() ? { notes: notes.trim() } : {}),
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="close-shift-title"
    >
      <div className="w-full max-w-lg rounded-lg border border-border bg-card text-card-foreground shadow-lg">
        <div className="flex items-start justify-between border-b border-border p-5">
          <div>
            <h2 id="close-shift-title" className="text-lg font-semibold text-card-foreground">
              Close the till
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Count the drawer and enter the total. You will see the variance before anything is
              saved.
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={reset}
            aria-label="Cancel closing the shift"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <form onSubmit={submit} className="space-y-4 p-5">
          {blocked && (
            <p
              role="alert"
              className="flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-700 dark:text-amber-300"
            >
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                {liveOrderCount} order{liveOrderCount === 1 ? '' : 's'} still open on this shift.
                Settle or cancel {liveOrderCount === 1 ? 'it' : 'them'} before closing.
              </span>
            </p>
          )}

          <div className="rounded-md bg-muted p-3">
            <div className="flex items-baseline justify-between">
              <span className="text-sm text-muted-foreground">Expected in drawer</span>
              <span className="text-lg font-semibold text-foreground">
                {formatMoney(expectedCash)}
              </span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Opening float plus cash sales, minus cash refunds.
            </p>
          </div>

          <div>
            <label
              htmlFor="counted-cash"
              className="mb-1 block text-sm font-medium text-card-foreground"
            >
              Counted cash (₹)
            </label>
            <input
              id="counted-cash"
              type="number"
              inputMode="decimal"
              min={0}
              step="0.01"
              value={countedCash}
              onChange={(e) => setCountedCash(e.target.value)}
              placeholder="0.00"
              autoFocus
              disabled={blocked}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-lg font-semibold text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50"
            />
          </div>

          {entered && <VariancePreview variance={variance} />}

          <div>
            <label
              htmlFor="closing-notes"
              className="mb-1 block text-sm font-medium text-card-foreground"
            >
              Notes {variance !== 0 && entered ? '(explain the difference)' : '(optional)'}
            </label>
            <textarea
              id="closing-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              maxLength={500}
              disabled={blocked}
              placeholder={
                variance < 0 ? 'e.g. ₹200 paid to the vegetable supplier from the drawer' : ''
              }
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50"
            />
          </div>

          {error && (
            <p
              role="alert"
              className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
            >
              {error}
            </p>
          )}

          <div className="flex gap-2 pt-1">
            <Button type="button" variant="outline" className="flex-1" onClick={reset}>
              Cancel
            </Button>
            <Button
              type="submit"
              className="flex-1"
              disabled={closeShift.isPending || blocked || !entered}
            >
              <Lock className="mr-2 h-4 w-4" />
              {closeShift.isPending ? 'Closing…' : 'Confirm and close'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

/** The number the cashier is actually being asked to sign off on. */
function VariancePreview({ variance }: { variance: number }) {
  if (variance === 0) {
    return (
      <div className="flex items-start gap-2 rounded-md border border-emerald-500/40 bg-emerald-500/10 px-3 py-3 text-sm text-emerald-700 dark:text-emerald-300">
        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
        <div>
          <p className="font-semibold">Drawer balances exactly</p>
          <p className="mt-0.5 text-emerald-700/80 dark:text-emerald-300/80">
            Counted cash matches the expected amount.
          </p>
        </div>
      </div>
    );
  }

  const over = variance > 0;
  const tone = over
    ? 'border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300'
    : 'border-destructive/40 bg-destructive/10 text-destructive';

  return (
    <div className={`flex items-start gap-2 rounded-md border px-3 py-3 text-sm ${tone}`}>
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
      <div>
        <p className="font-semibold">
          {over ? 'Over' : 'Short'} by {formatMoney(Math.abs(variance))}
        </p>
        <p className="mt-0.5 opacity-80">
          {over
            ? 'More cash than expected. Usually an unrecorded cash sale, or change that was never given.'
            : 'Less cash than expected. Usually a missed cash payment entry, a payout taken from the drawer, or change given twice.'}
        </p>
      </div>
    </div>
  );
}
