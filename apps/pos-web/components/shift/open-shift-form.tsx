'use client';

import { useState } from 'react';
import { Banknote, LockOpen } from 'lucide-react';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';

interface OpenShiftFormProps {
  branchId: string;
  branchName?: string;
  onOpened: () => void;
}

/** Cash the drawer usually starts with. Saves typing on the common case. */
const FLOAT_PRESETS = [500, 1000, 2000, 5000];

export function OpenShiftForm({ branchId, branchName, onOpened }: OpenShiftFormProps) {
  const [openingCash, setOpeningCash] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);

  const openShift = trpc.shift.open.useMutation({
    onSuccess: () => {
      setOpeningCash('');
      setNotes('');
      setError(null);
      onOpened();
    },
    onError: (err) => setError(err.message),
  });

  const parsed = Number(openingCash);
  const valid = openingCash !== '' && Number.isFinite(parsed) && parsed >= 0;

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!valid) {
      setError('Enter the cash you are putting in the drawer.');
      return;
    }
    setError(null);
    openShift.mutate({
      branchId,
      openingCash: Math.round(parsed * 100) / 100,
      ...(notes.trim() ? { notes: notes.trim() } : {}),
    });
  };

  return (
    <div className="mx-auto max-w-xl">
      <div className="rounded-lg border border-border bg-card p-6 text-card-foreground shadow">
        <div className="mb-6 flex items-start gap-3">
          <div className="rounded-lg bg-muted p-3">
            <Banknote className="h-6 w-6 text-muted-foreground" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-card-foreground">Open the till</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              No shift is running{branchName ? ` at ${branchName}` : ''}. Count the float in the
              drawer and open a shift before taking orders, so the day&apos;s cash can be
              reconciled.
            </p>
          </div>
        </div>

        <form onSubmit={submit} className="space-y-5">
          <div>
            <label
              htmlFor="opening-cash"
              className="mb-1 block text-sm font-medium text-card-foreground"
            >
              Opening cash (₹)
            </label>
            <input
              id="opening-cash"
              type="number"
              inputMode="decimal"
              min={0}
              step="0.01"
              value={openingCash}
              onChange={(e) => setOpeningCash(e.target.value)}
              placeholder="0.00"
              autoFocus
              aria-describedby="opening-cash-help"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-lg font-semibold text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
            <p id="opening-cash-help" className="mt-1 text-xs text-muted-foreground">
              The physical cash in the drawer right now, before any sales.
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {FLOAT_PRESETS.map((preset) => (
                <Button
                  key={preset}
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setOpeningCash(String(preset))}
                >
                  ₹{preset.toLocaleString('en-IN')}
                </Button>
              ))}
            </div>
          </div>

          <div>
            <label
              htmlFor="opening-notes"
              className="mb-1 block text-sm font-medium text-card-foreground"
            >
              Notes (optional)
            </label>
            <textarea
              id="opening-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              maxLength={500}
              placeholder="Anything the next person should know"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
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

          <Button type="submit" className="w-full" disabled={openShift.isPending}>
            <LockOpen className="mr-2 h-4 w-4" />
            {openShift.isPending ? 'Opening shift…' : 'Open shift'}
          </Button>
        </form>
      </div>
    </div>
  );
}
