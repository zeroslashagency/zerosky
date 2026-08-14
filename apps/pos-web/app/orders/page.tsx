'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ShoppingCart, Plus, AlertCircle } from 'lucide-react';
import { keepPreviousData } from '@tanstack/react-query';
import { trpc } from '@/lib/trpc';
import { useBranch } from '@/hooks/use-branch';
import { cn } from '@/lib/utils';

type OrderStatus =
  | 'OPEN'
  | 'SENT_TO_KITCHEN'
  | 'READY'
  | 'SERVED'
  | 'BILLED'
  | 'PAID'
  | 'CANCELLED';

const STATUSES: OrderStatus[] = [
  'OPEN',
  'SENT_TO_KITCHEN',
  'READY',
  'SERVED',
  'BILLED',
  'PAID',
  'CANCELLED',
];

const STATUS_DOT: Record<OrderStatus, string> = {
  OPEN: 'bg-zinc-400', SENT_TO_KITCHEN: 'bg-amber-500', READY: 'bg-sky-500', SERVED: 'bg-indigo-500', BILLED: 'bg-violet-500', PAID: 'bg-emerald-500', CANCELLED: 'bg-red-500',
};
const STATUS_STYLES: Record<OrderStatus, string> = {
  OPEN: 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200', SENT_TO_KITCHEN: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-100', READY: 'bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-100', SERVED: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-100', BILLED: 'bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-100', PAID: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-100', CANCELLED: 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-100',
};

/** Format a paise-safe decimal string as rupees. */
function rupees(value: string | number): string {
  return `₹${Number(value).toFixed(2)}`;
}

export default function OrdersPage() {
  const { branchId, isLoading: branchLoading, error: branchError } = useBranch();
  const [filter, setFilter] = useState<OrderStatus | 'ALL'>('ALL');

  const ordersQuery = trpc.order.list.useQuery(
    {
      branchId: branchId ?? '',
      limit: 50,
      ...(filter === 'ALL' ? {} : { status: filter }),
    },
    {
      enabled: Boolean(branchId),
      refetchInterval: 15_000,
      placeholderData: keepPreviousData,
      staleTime: 15_000,
    },
  );

  if (branchLoading) return <div className="bento-canvas min-h-[100dvh] p-6"><div className="mx-auto max-w-[1400px] space-y-4"><div className="h-8 w-40 shimmer rounded-xl" /><div className="h-20 shimmer rounded-2xl" /></div></div>;

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

  const orders = ordersQuery.data ?? [];

  return (
    <div className="bento-canvas min-h-[100dvh] p-4 sm:p-6">
      <div className="mx-auto max-w-[1400px]">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><h1 className="flex items-center gap-2 text-4xl font-semibold tracking-tighter leading-none text-foreground md:text-5xl"><ShoppingCart strokeWidth={1.5} className="h-7 w-7" /> Orders</h1><p className="mt-2 text-sm leading-relaxed text-muted-foreground">{orders.length} order{orders.length === 1 ? '' : 's'}{filter !== 'ALL' && ` · ${filter}`}</p></div>
        <Link href="/orders/create" className="flex min-h-[44px] items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 active:scale-[0.98] transition"><Plus strokeWidth={1.5} className="h-4 w-4" /> New order</Link>
      </div>
      <div className="mt-6 -mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0">
        <button onClick={() => setFilter('ALL')} className={cn('shrink-0 rounded-full px-3.5 py-2 text-xs font-semibold min-h-[36px] active:scale-[0.98] transition', filter === 'ALL' ? 'bg-foreground text-background' : 'bg-muted text-muted-foreground')}>All</button>
        {STATUSES.map((s) => <button key={s} onClick={() => setFilter(s)} className={cn('inline-flex items-center gap-1.5 shrink-0 rounded-full px-3.5 py-2 text-xs font-medium min-h-[36px] active:scale-[0.98] transition', filter === s ? 'bg-foreground text-background' : STATUS_STYLES[s])}><span className={cn('h-2 w-2 rounded-full', STATUS_DOT[s])} aria-hidden />{s}</button>)}
      </div>

      {ordersQuery.isLoading && !ordersQuery.data ? <div className="mt-6 space-y-2">{Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-14 shimmer rounded-2xl" />)}</div> : orders.length === 0 ? <div className="mx-auto mt-10 max-w-md rounded-[2.5rem] border border-dashed border-border bg-card/50 p-10 text-center"><ShoppingCart strokeWidth={1.5} className="mx-auto mb-3 h-10 w-10 text-muted-foreground" /><p className="font-medium tracking-tight text-foreground">No orders found</p><p className="mx-auto mt-1 max-w-[32ch] text-sm leading-relaxed text-muted-foreground">{filter === 'ALL' ? 'Create an order to get started.' : `No orders with status ${filter}.`}</p></div> : (
        <div className="mt-6">
          <div className="grid gap-3 sm:hidden">{orders.map((order) => <Link key={order.id} href={`/orders/${order.id}`} prefetch={false} className="bento-card p-4 active:scale-[0.98] transition"><div className="flex items-start justify-between gap-3"><span className="font-mono text-sm font-semibold tracking-tight text-foreground">{order.orderNumber}</span><span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-medium', STATUS_STYLES[order.status as OrderStatus])}><span className={cn('h-1.5 w-1.5 rounded-full', STATUS_DOT[order.status as OrderStatus])} aria-hidden />{order.status}</span></div><div className="mt-2 flex items-center justify-between text-sm"><span className="text-muted-foreground">{order.type} · {order.items?.length ?? 0} items</span><span className="font-mono font-semibold text-foreground">{rupees(String(order.grandTotal))}</span></div><p className="mt-1 text-xs text-muted-foreground">{new Date(order.createdAt).toLocaleString('en-IN')}</p></Link>)}</div>
          <div className="mt-4 hidden overflow-hidden rounded-[1.75rem] border border-border bg-card sm:block"><table className="w-full text-sm"><caption className="sr-only">List of orders for this branch</caption><thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground"><tr><th scope="col" className="px-4 py-3">Order</th><th scope="col" className="px-4 py-3">Type</th><th scope="col" className="px-4 py-3">Status</th><th scope="col" className="px-4 py-3 text-right">Items</th><th scope="col" className="px-4 py-3 text-right">Total</th><th scope="col" className="px-4 py-3">Created</th></tr></thead><tbody className="divide-y divide-border">{orders.map((order) => <tr key={order.id} className="hover:bg-muted/50"><td className="px-4 py-3"><Link href={`/orders/${order.id}`} prefetch={false} className="font-mono font-semibold tracking-tight text-primary hover:underline">{order.orderNumber}</Link></td><td className="px-4 py-3 text-foreground">{order.type}</td><td className="px-4 py-3"><span className={cn('inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium', STATUS_STYLES[order.status as OrderStatus])}><span className={cn('h-1.5 w-1.5 rounded-full', STATUS_DOT[order.status as OrderStatus])} aria-hidden />{order.status}</span></td><td className="px-4 py-3 text-right font-mono text-foreground">{order.items?.length ?? 0}</td><td className="px-4 py-3 text-right font-mono font-semibold text-foreground">{rupees(String(order.grandTotal))}</td><td className="px-4 py-3 text-muted-foreground">{new Date(order.createdAt).toLocaleString('en-IN')}</td></tr>)}</tbody></table></div>
        </div>
      )}
      </div>
    </div>
  );
}
