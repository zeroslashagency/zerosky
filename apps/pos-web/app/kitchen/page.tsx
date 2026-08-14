'use client';

import { useState } from 'react';
import { ChefHat, Clock, CheckCircle2, AlertCircle, RefreshCw, Printer } from 'lucide-react';
import { keepPreviousData } from '@tanstack/react-query';
import { trpc } from '@/lib/trpc';
import { useBranch } from '@/hooks/use-branch';
import { usePrintKot } from '@/hooks/use-print';
import { cn } from '@/lib/utils';

type KotStatus = 'NEW' | 'MODIFIED' | 'PARTIAL' | 'READY' | 'SERVED' | 'CANCELLED';

const ACTIVE_STATUSES: KotStatus[] = ['NEW', 'MODIFIED', 'PARTIAL'];

const STATUS_STYLES: Record<KotStatus, string> = {
  NEW: 'bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-950 dark:text-amber-100 dark:border-amber-800',
  MODIFIED: 'bg-orange-100 text-orange-900 border-orange-300 dark:bg-orange-950 dark:text-orange-100 dark:border-orange-800',
  PARTIAL: 'bg-blue-100 text-blue-900 border-blue-300 dark:bg-blue-950 dark:text-blue-100 dark:border-blue-800',
  READY: 'bg-green-100 text-green-900 border-green-300 dark:bg-green-950 dark:text-green-100 dark:border-green-800',
  SERVED: 'bg-gray-100 text-gray-700 border-gray-300 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-600',
  CANCELLED: 'bg-red-100 text-red-900 border-red-300 dark:bg-red-950 dark:text-red-100 dark:border-red-800',
};

/** Minutes elapsed since a KOT was created, used to flag ageing tickets. */
function minutesSince(iso: string | Date): number {
  const then = typeof iso === 'string' ? new Date(iso) : iso;
  return Math.floor((Date.now() - then.getTime()) / 60000);
}

export default function KitchenPage() {
  const { branchId, isLoading: branchLoading, error: branchError } = useBranch();
  const [showCompleted, setShowCompleted] = useState(false);

  const kotQuery = trpc.kot.list.useQuery(
    branchId ? { branchId } : { branchId: '' },
    {
      enabled: Boolean(branchId),
      // The kitchen screen is a live queue; poll so new tickets appear.
      refetchInterval: 10_000,
      placeholderData: keepPreviousData,
      staleTime: 5_000,
    },
  );

  const setStatus = trpc.kot.setStatus.useMutation({
    onSuccess: () => kotQuery.refetch(),
  });

  const { print, reprint } = usePrintKot();

  if (branchLoading) {
    return <div className="p-6 text-muted-foreground animate-pulse">Loading branch…</div>;
  }

  if (branchError || !branchId) {
    return (
      <div className="p-6">
        <div className="flex items-center gap-2 rounded-lg border border-destructive/20 bg-destructive/10 p-4 text-destructive">
          <AlertCircle className="h-5 w-5" />
          <span>{branchError ?? 'No branch available for this tenant.'}</span>
        </div>
      </div>
    );
  }

  const allKots = kotQuery.data ?? [];
  const kots = showCompleted
    ? allKots
    : allKots.filter((k) => ACTIVE_STATUSES.includes(k.status as KotStatus));

  return (
    <div className="p-4 sm:p-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl sm:text-3xl font-bold text-foreground">
            <ChefHat className="h-6 w-6 sm:h-7 sm:w-7" />
            Kitchen Display
          </h1>
          <p className="text-sm text-muted-foreground">
            {kots.length} {showCompleted ? 'total' : 'active'} ticket
            {kots.length === 1 ? '' : 's'}
          </p>
        </div>
        <div className="flex w-full gap-2 sm:w-auto">
          <button onClick={() => setShowCompleted((v) => !v)} className="min-h-[44px] flex-1 rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-muted sm:flex-none">
            {showCompleted ? 'Show active only' : 'Show all'}
          </button>
          <button onClick={() => kotQuery.refetch()} disabled={kotQuery.isFetching} className="flex min-h-[44px] items-center justify-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-muted disabled:opacity-50 sm:flex-none">
            <RefreshCw className={cn('h-4 w-4', kotQuery.isFetching && 'animate-spin')} />
            Refresh
          </button>
        </div>
      </div>

      {kotQuery.isLoading && !kotQuery.data ? (
        <div className="text-muted-foreground animate-pulse">Loading tickets…</div>
      ) : kots.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-12 text-center">
          <ChefHat className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
          <p className="font-medium text-foreground">No tickets in the queue</p>
          <p className="text-sm text-muted-foreground">
            New orders sent to the kitchen will appear here automatically.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:gap-4 md:grid-cols-2 xl:grid-cols-3">
          {kots.map((kot) => {
            const age = minutesSince(kot.createdAt);
            const status = kot.status as KotStatus;
            const isActive = ACTIVE_STATUSES.includes(status);

            return (
              <div
                key={kot.id}
                className={cn(
                  'rounded-lg border-2 p-4 shadow-sm',
                  STATUS_STYLES[status] ?? STATUS_STYLES.NEW,
                )}
              >
                <div className="mb-3 flex items-start justify-between">
                  <div className="flex-1">
                    <p className="font-mono text-lg font-bold text-foreground">{kot.kotNumber}</p>
                    <p className="text-xs opacity-75">{kot.station ?? 'KITCHEN'}</p>
                    {kot.printedAt && (
                      <p className="mt-1 text-xs opacity-60">
                        Printed {new Date(kot.printedAt).toLocaleTimeString()}
                      </p>
                    )}
                  </div>
                  <div className="text-right">
                    <span className="rounded-full bg-background/60 px-2 py-1 text-xs font-semibold">
                      {status}
                    </span>
                    <p
                      className={cn(
                        'mt-1 flex items-center justify-end gap-1 text-xs',
                        age >= 15 ? 'font-bold text-destructive' : 'opacity-75',
                      )}
                    >
                      <Clock className="h-3 w-3" />
                      {age}m
                    </p>
                  </div>
                </div>

                <ul className="mb-4 space-y-1 border-t border-current/20 pt-3">
                  {kot.items.map((item) => (
                    <li key={item.id} className="text-sm">
                      <span className="font-semibold text-foreground">{item.quantity}×</span> {item.name}
                      {item.notes && (
                        <span className="mt-0.5 block pl-5 text-xs italic opacity-80">
                          {item.notes}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>

                <div className="mb-2 flex gap-2">
                  <button
                    onClick={() => print.mutate({ kotId: kot.id })}
                    disabled={print.isPending || reprint.isPending}
                    className="flex items-center justify-center gap-1 rounded-md border border-current/30 px-3 py-2 text-sm font-medium hover:bg-muted disabled:opacity-50"
                    title={kot.printedAt ? 'Print again' : 'Print KOT'}
                  >
                    <Printer className="h-4 w-4" />
                    {kot.printedAt ? 'Print' : 'Print'}
                  </button>
                  {kot.printedAt && (
                    <button
                      onClick={() => reprint.mutate({ kotId: kot.id })}
                      disabled={print.isPending || reprint.isPending}
                      className="flex items-center justify-center gap-1 rounded-md border border-current/30 px-3 py-2 text-sm font-medium hover:bg-muted disabled:opacity-50"
                      title="Reprint (marked as reprint on ticket)"
                    >
                      <Printer className="h-4 w-4" />
                      Reprint
                    </button>
                  )}
                </div>

                {isActive && (
                  <div className="flex gap-2">
                    <button
                      onClick={() => setStatus.mutate({ id: kot.id, status: 'READY' })}
                      disabled={setStatus.isPending}
                      className="flex flex-1 items-center justify-center gap-1 rounded-md bg-green-600 px-3 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
                    >
                      <CheckCircle2 className="h-4 w-4" />
                      Mark ready
                    </button>
                    <button
                      onClick={() => setStatus.mutate({ id: kot.id, status: 'CANCELLED' })}
                      disabled={setStatus.isPending}
                      className="rounded-md border border-current/30 px-3 py-2 text-sm font-medium hover:bg-muted disabled:opacity-50"
                    >
                      Cancel
                    </button>
                  </div>
                )}

                {status === 'READY' && (
                  <button
                    onClick={() => setStatus.mutate({ id: kot.id, status: 'SERVED' })}
                    disabled={setStatus.isPending}
                    className="w-full rounded-md bg-foreground px-3 py-2 text-sm font-medium text-background hover:bg-foreground/90 disabled:opacity-50"
                  >
                    Mark served
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {setStatus.error && (
        <div className="mt-4 rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">
          {setStatus.error.message}
        </div>
      )}

      {print.error && (
        <div className="mt-4 rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">
          Print failed: {print.error.message}
        </div>
      )}

      {reprint.error && (
        <div className="mt-4 rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">
          Reprint failed: {reprint.error.message}
        </div>
      )}
    </div>
  );
}
