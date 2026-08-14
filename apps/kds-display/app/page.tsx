'use client';

import { useEffect, useState } from 'react';
import { ChefHat, Clock, CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react';
import { trpc } from '@/lib/trpc';
import { useBranch } from '@/hooks/use-branch';
import { cn } from '@/lib/utils';

type KotStatus = 'NEW' | 'MODIFIED' | 'PARTIAL' | 'READY' | 'SERVED' | 'CANCELLED';

const ACTIVE_STATUSES: KotStatus[] = ['NEW', 'MODIFIED', 'PARTIAL'];

// Card styles are dark-aware: light surface/border in :root, dark tokens under .dark.
// Contrast checked against @zerosky/ui theme.css (both modes >= WCAG AA).
const STATUS_STYLES: Record<KotStatus, string> = {
  NEW: 'bg-card text-card-foreground border-amber-300 dark:border-amber-700',
  MODIFIED: 'bg-card text-card-foreground border-orange-300 dark:border-orange-700',
  PARTIAL: 'bg-card text-card-foreground border-blue-300 dark:border-blue-700',
  READY: 'bg-card text-card-foreground border-green-300 dark:border-green-700',
  SERVED: 'bg-card text-card-foreground border-border',
  CANCELLED: 'bg-card text-card-foreground border-destructive/30',
};

function minutesSince(iso: string | Date, now: number): number {
  const then = typeof iso === 'string' ? new Date(iso) : iso;
  return Math.floor((now - then.getTime()) / 60000);
}

function useNow(intervalMs = 30_000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

export default function KitchenDisplayPage() {
  const { branchId, isLoading: branchLoading, error: branchError, refetch: refetchBranch } = useBranch();
  const [showCompleted, setShowCompleted] = useState(false);
  const now = useNow(30_000);

  const utils = trpc.useUtils();
  const kotQuery = trpc.kot.list.useQuery(
    branchId ? { branchId } : { branchId: '' },
    {
      enabled: Boolean(branchId),
      // The kitchen screen is a live queue; poll so new tickets appear.
      refetchInterval: 10_000,
    },
  );

  const setStatus = trpc.kot.setStatus.useMutation({
    onSuccess: () => utils.kot.list.invalidate(),
  });

  if (branchLoading) {
    return <div className="p-6 text-muted-foreground">Loading branch…</div>;
  }

  if (branchError || !branchId) {
    return (
      <div className="p-6">
        <div className="flex items-center gap-2 rounded-lg border border-destructive/20 bg-destructive/10 p-4 text-destructive">
          <AlertCircle className="h-5 w-5" />
          <span>{branchError ?? 'No branch available for this tenant.'}</span>
          <button
            onClick={() => refetchBranch()}
            className="ml-auto rounded-md border border-current px-3 py-1 text-sm font-medium hover:bg-destructive/10"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const allKots = kotQuery.data ?? [];
  const kots = showCompleted
    ? allKots
    : allKots.filter((k) => ACTIVE_STATUSES.includes(k.status as KotStatus));

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-3xl font-bold text-foreground">
            <ChefHat className="h-7 w-7" />
            Kitchen Display
          </h1>
          <p className="text-sm text-muted-foreground" aria-live="polite" aria-atomic="true">
            {kots.length} {showCompleted ? 'total' : 'active'} ticket
            {kots.length === 1 ? '' : 's'}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowCompleted((v) => !v)}
            className="rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium text-card-foreground hover:bg-muted"
          >
            {showCompleted ? 'Show active only' : 'Show all'}
          </button>
          <button
            onClick={() => kotQuery.refetch()}
            disabled={kotQuery.isFetching}
            className="flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium text-card-foreground hover:bg-muted disabled:opacity-50"
          >
            <RefreshCw className={cn('h-4 w-4', kotQuery.isFetching && 'animate-spin')} />
            Refresh
          </button>
        </div>
      </div>

      {kotQuery.isLoading ? (
        <div className="text-muted-foreground">Loading tickets…</div>
      ) : kots.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-12 text-center">
          <ChefHat className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
          <p className="font-medium text-foreground">No tickets in the queue</p>
          <p className="text-sm text-muted-foreground">
            New orders sent to the kitchen will appear here automatically.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {kots.map((kot) => {
            const age = minutesSince(kot.createdAt, now);
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
                  <div>
                    <p className="font-mono text-lg font-bold text-foreground">{kot.kotNumber}</p>
                    <p className="text-xs opacity-75">{kot.station ?? 'KITCHEN'}</p>
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
                      className="rounded-md border border-current/30 px-3 py-2 text-sm font-medium hover:bg-white/40 disabled:opacity-50"
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
    </div>
  );
}
