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
const STATUS_DOT: Record<KotStatus, string> = {
  NEW: 'bg-amber-500', MODIFIED: 'bg-orange-500', PARTIAL: 'bg-sky-500',
  READY: 'bg-emerald-500', SERVED: 'bg-zinc-400', CANCELLED: 'bg-red-500',
};
const STATUS_LABEL: Record<KotStatus, string> = {
  NEW: 'FIRE', MODIFIED: 'MOD', PARTIAL: 'PARTIAL', READY: 'READY', SERVED: 'SERVED', CANCELLED: 'VOID',
};

function minutesSince(iso: string | Date): number {
  const then = typeof iso === 'string' ? new Date(iso) : iso;
  return Math.floor((Date.now() - then.getTime()) / 60000);
}

export default function KitchenPage() {
  const { branchId, isLoading: branchLoading, error: branchError } = useBranch();
  const [showCompleted, setShowCompleted] = useState(false);
  const kotQuery = trpc.kot.list.useQuery(branchId ? { branchId } : { branchId: '' }, { enabled: Boolean(branchId), refetchInterval: 10_000, placeholderData: keepPreviousData, staleTime: 5_000 });
  const setStatus = trpc.kot.setStatus.useMutation({ onSuccess: () => kotQuery.refetch() });
  const { print, reprint } = usePrintKot();

  if (branchLoading) return <div className="bento-canvas min-h-[100dvh] p-6"><div className="mx-auto max-w-[1400px] space-y-4"><div className="h-8 w-40 shimmer rounded-xl" /><div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="bento-card h-56" />)}</div></div></div>;
  if (branchError || !branchId) return <div className="p-6"><div className="flex items-center gap-2 rounded-xl border border-destructive/20 bg-destructive/10 p-4 text-destructive"><AlertCircle strokeWidth={1.5} className="h-5 w-5" /><span>{branchError ?? 'No branch available for this tenant.'}</span></div></div>;

  const allKots = kotQuery.data ?? [];
  const kots = showCompleted ? allKots : allKots.filter((k) => ACTIVE_STATUSES.includes(k.status as KotStatus));

  return (
    <div className="bento-canvas min-h-[100dvh] p-4 sm:p-6">
      <div className="mx-auto max-w-[1400px]">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="flex items-center gap-2 text-4xl font-semibold tracking-tighter leading-none text-foreground md:text-5xl"><ChefHat strokeWidth={1.5} className="h-7 w-7" /> Kitchen</h1>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{kots.length} {showCompleted ? 'total' : 'live'} ticket{kots.length === 1 ? '' : 's'} · 10s poll</p>
          </div>
          <div className="flex w-full gap-2 sm:w-auto">
            <button onClick={() => setShowCompleted((v) => !v)} className="min-h-[44px] flex-1 rounded-full border border-border bg-card px-5 py-2 text-sm font-medium hover:bg-muted sm:flex-none active:scale-[0.98] transition">{showCompleted ? 'Active only' : 'Show all'}</button>
            <button onClick={() => kotQuery.refetch()} disabled={kotQuery.isFetching} className="flex min-h-[44px] items-center justify-center gap-2 rounded-full border border-border bg-card px-5 py-2 text-sm font-medium hover:bg-muted disabled:opacity-50 sm:flex-none active:scale-[0.98] transition"><RefreshCw strokeWidth={1.5} className={cn('h-4 w-4', kotQuery.isFetching && 'animate-spin')} /> Refresh</button>
          </div>
        </div>

        {kotQuery.isLoading && !kotQuery.data ? (
          <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="bento-card h-44" />)}</div>
        ) : kots.length === 0 ? (
          <div className="mx-auto mt-10 max-w-md rounded-[2.5rem] border border-dashed border-border bg-card/50 p-10 text-center">
            <ChefHat strokeWidth={1.5} className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
            <p className="font-medium tracking-tight text-foreground">No tickets in the queue</p>
            <p className="mx-auto mt-1 max-w-[32ch] text-sm leading-relaxed text-muted-foreground">New orders sent to the kitchen will appear here automatically.</p>
          </div>
        ) : (
          <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {kots.map((kot) => {
              const age = minutesSince(kot.createdAt);
              const status = kot.status as KotStatus;
              const isActive = ACTIVE_STATUSES.includes(status);
              const dot = STATUS_DOT[status] ?? STATUS_DOT.NEW;
              const isLate = age >= 15;
              return (
                <div key={kot.id} className="bento-card p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2"><span className={cn('h-2 w-2 rounded-full', dot)} aria-hidden /><p className="font-mono text-sm font-semibold tracking-tight text-foreground">{kot.kotNumber}</p><span className="rounded-full border border-border bg-muted px-2 py-0.5 text-[11px] font-medium tracking-wide text-muted-foreground">{STATUS_LABEL[status]}</span></div>
                      <p className="mt-1 text-xs tracking-wide text-muted-foreground">{kot.station ?? 'KITCHEN'}{kot.printedAt ? ` · printed ${new Date(kot.printedAt).toLocaleTimeString()}` : ''}</p>
                    </div>
                    <span className={cn('inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-mono font-medium', isLate ? 'border-destructive/30 bg-destructive/10 text-destructive' : 'border-border bg-muted text-muted-foreground')}><Clock strokeWidth={1.5} className="h-3 w-3" />{age}m</span>
                  </div>
                  <ul className="mt-4 space-y-1.5 border-t border-border pt-4">
                    {kot.items.map((item) => (
                      <li key={item.id} className="flex gap-2 text-sm leading-relaxed"><span className="font-mono font-semibold text-foreground">{item.quantity}×</span><span className="text-foreground">{item.name}{item.notes && <span className="block text-xs italic text-muted-foreground">{item.notes}</span>}</span></li>
                    ))}
                  </ul>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <button onClick={() => print.mutate({ kotId: kot.id })} disabled={print.isPending || reprint.isPending} className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3.5 py-2 text-xs font-medium hover:bg-muted disabled:opacity-50 active:scale-[0.98] transition"><Printer strokeWidth={1.5} className="h-3.5 w-3.5" />{kot.printedAt ? 'Print' : 'Print'}</button>
                    {kot.printedAt && <button onClick={() => reprint.mutate({ kotId: kot.id })} disabled={print.isPending || reprint.isPending} className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3.5 py-2 text-xs font-medium hover:bg-muted disabled:opacity-50 active:scale-[0.98] transition"><Printer strokeWidth={1.5} className="h-3.5 w-3.5" />Reprint</button>}
                  </div>
                  {isActive && <div className="mt-3 flex gap-2"><button onClick={() => setStatus.mutate({ id: kot.id, status: 'READY' })} disabled={setStatus.isPending} className="flex flex-1 items-center justify-center gap-1.5 rounded-full bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50 active:scale-[0.98] transition"><CheckCircle2 strokeWidth={1.5} className="h-4 w-4" /> Mark ready</button><button onClick={() => setStatus.mutate({ id: kot.id, status: 'CANCELLED' })} disabled={setStatus.isPending} className="rounded-full border border-border bg-card px-4 py-2.5 text-sm font-medium hover:bg-muted disabled:opacity-50 active:scale-[0.98] transition">Cancel</button></div>}
                  {status === 'READY' && <button onClick={() => setStatus.mutate({ id: kot.id, status: 'SERVED' })} disabled={setStatus.isPending} className="mt-3 w-full rounded-full bg-foreground px-4 py-2.5 text-sm font-medium text-background hover:bg-foreground/90 disabled:opacity-50 active:scale-[0.98] transition">Mark served</button>}
                </div>
              );
            })}
          </div>
        )}
        {setStatus.error && <div className="mt-4 rounded-xl border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">{setStatus.error.message}</div>}
        {print.error && <div className="mt-4 rounded-xl border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">Print failed: {print.error.message}</div>}
        {reprint.error && <div className="mt-4 rounded-xl border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">Reprint failed: {reprint.error.message}</div>}
      </div>
    </div>
  );
}
