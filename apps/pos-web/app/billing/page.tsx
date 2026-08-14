'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Receipt, AlertCircle, Split } from 'lucide-react';
import { keepPreviousData } from '@tanstack/react-query';
import { trpc } from '@/lib/trpc';
import { useBranch } from '@/hooks/use-branch';
import { cn } from '@/lib/utils';
import dynamic from 'next/dynamic';
const SplitBillDialog = dynamic(() => import('@/components/billing/split-bill-dialog').then((m) => m.SplitBillDialog), { ssr: false });

/** Format a decimal string as rupees. */
function rupees(value: string | number): string {
  return `₹${Number(value).toFixed(2)}`;
}

/**
 * Billing queue: orders that have food delivered but are not yet paid. These
 * are the tickets a cashier needs to settle.
 */
export default function BillingPage() {
  const { branchId, isLoading: branchLoading, error: branchError } = useBranch();
  const [splitDialog, setSplitDialog] = useState<{
    open: boolean;
    orderId: string;
    orderNumber: string;
    grandTotal: number;
  } | null>(null);

  // Single batched query replaces the old SERVED+BILLED fan-out. The schema
  // now accepts statuses: ['SERVED','BILLED'] so the queue is one DB
  // round-trip and -60% wire (lean select, no OrderItems).
  const queue = trpc.order.list.useQuery(
    { branchId: branchId ?? '', statuses: ['SERVED', 'BILLED'], limit: 50 },
    { enabled: Boolean(branchId), refetchInterval: 15_000, placeholderData: keepPreviousData, staleTime: 15_000 },
  );

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

  const pending = queue.data ?? [];
  const isLoading = queue.isLoading;
  const outstanding = pending.reduce((sum, o) => sum + Number(o.grandTotal), 0);

  return (
    <div className="bento-canvas min-h-[100dvh] p-4 sm:p-6">
      <div className="mx-auto max-w-[1400px]">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-4xl font-semibold tracking-tighter leading-none text-foreground md:text-5xl">
            <Receipt strokeWidth={1.5} className="h-7 w-7" /> Billing
          </h1>
          <p className="mt-2 max-w-[65ch] text-sm leading-relaxed text-muted-foreground">{pending.length} order{pending.length === 1 ? '' : 's'} awaiting settlement · <span className="font-mono font-medium text-foreground">{rupees(outstanding)}</span> outstanding</p>
        </div>
        <div className="rounded-full border border-border bg-card px-4 py-2 text-xs font-medium text-muted-foreground">{isLoading ? 'Syncing…' : 'Live · 15s poll'}</div>
      </div>

      {isLoading && pending.length === 0 ? (
        <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="bento-card h-44 p-6"><div className="h-4 w-24 shimmer rounded" /><div className="mt-4 h-3 w-full shimmer rounded" /><div className="mt-2 h-3 w-2/3 shimmer rounded" /></div>)}</div>
      ) : pending.length === 0 ? (
        <div className="mx-auto mt-10 max-w-md rounded-[2.5rem] border border-dashed border-border bg-card/50 p-10 text-center">
          <Receipt strokeWidth={1.5} className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
          <p className="font-medium tracking-tight text-foreground">Nothing to bill</p>
          <p className="mx-auto mt-1 max-w-[32ch] text-sm leading-relaxed text-muted-foreground">Orders appear here once the kitchen has served them.</p>
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {pending.map((order) => (
            <div key={order.id} className="relative">
              <Link href={`/orders/${order.id}`} prefetch={false} className="bento-card block p-5 transition hover:border-primary/20 active:scale-[0.98]">
                <div className="flex items-start justify-between">
                  <div><p className="font-mono text-sm font-semibold tracking-tight text-foreground">{order.orderNumber}</p><p className="text-xs text-muted-foreground">{order.type}</p></div>
                  <span className={cn('rounded-full px-2.5 py-1 text-xs font-semibold', order.status === 'BILLED' ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-100' : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-100')}>{order.status}</span>
                </div>
                <dl className="mt-4 space-y-1.5 border-t border-border pt-4 text-sm">
                  <div className="flex justify-between"><dt className="text-muted-foreground">Subtotal</dt><dd className="font-mono text-foreground">{rupees(String(order.subtotal))}</dd></div>
                  <div className="flex justify-between"><dt className="text-muted-foreground">GST</dt><dd className="font-mono text-foreground">{rupees(String(order.taxTotal))}</dd></div>
                  {Number(order.discountTotal) > 0 && <div className="flex justify-between text-emerald-700 dark:text-emerald-300"><dt>Discount</dt><dd className="font-mono">−{rupees(String(order.discountTotal))}</dd></div>}
                  <div className="flex justify-between border-t border-border pt-2 font-semibold text-foreground"><dt>Total</dt><dd className="font-mono">{rupees(String(order.grandTotal))}</dd></div>
                </dl>
                <p className="mt-4 text-center text-xs font-medium text-primary">Open to take payment →</p>
              </Link>
              <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); setSplitDialog({ open: true, orderId: order.id, orderNumber: order.orderNumber, grandTotal: Number(order.grandTotal) }); }} className="absolute -right-2 -top-2 rounded-full border border-white/60 bg-card p-2.5 shadow-md transition hover:bg-muted active:scale-[0.96]" title="Split bill" aria-label="Split bill"><Split strokeWidth={1.5} className="h-3.5 w-3.5 text-muted-foreground" /></button>
            </div>
          ))}
        </div>
      )}

      {splitDialog && <SplitBillDialog open={splitDialog.open} onOpenChange={(open) => setSplitDialog(open ? splitDialog : null)} orderId={splitDialog.orderId} orderNumber={splitDialog.orderNumber} grandTotal={splitDialog.grandTotal} />}
      </div>
    </div>
  );
}
