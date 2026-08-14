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

const STATUS_STYLES: Record<OrderStatus, string> = {
  OPEN: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200',
  SENT_TO_KITCHEN: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-100',
  READY: 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-100',
  SERVED: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-100',
  BILLED: 'bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-100',
  PAID: 'bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-100',
  CANCELLED: 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-100',
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

  const orders = ordersQuery.data ?? [];

  return (
    <div className="p-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-3xl font-bold text-foreground">
            <ShoppingCart className="h-7 w-7" />
            Orders
          </h1>
          <p className="text-sm text-muted-foreground">
            {orders.length} order{orders.length === 1 ? '' : 's'}
            {filter !== 'ALL' && ` · ${filter}`}
          </p>
        </div>
        <Link
          href="/orders/create"
          className="flex items-center gap-2 rounded-lg bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" />
          New order
        </Link>
      </div>

      <div className="mb-6 flex flex-wrap gap-2">
        <button
          onClick={() => setFilter('ALL')}
          className={cn(
            'rounded-full px-3 py-1 text-xs font-semibold',
            filter === 'ALL' ? 'bg-foreground text-background' : 'bg-muted text-muted-foreground',
          )}
        >
          All
        </button>
        {STATUSES.map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={cn(
              'rounded-full px-3 py-1 text-xs font-semibold',
              filter === s ? 'bg-foreground text-background' : STATUS_STYLES[s],
            )}
          >
            {s}
          </button>
        ))}
      </div>

      {ordersQuery.isLoading && !ordersQuery.data ? (
        <div className="text-muted-foreground animate-pulse">Loading orders…</div>
      ) : orders.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-12 text-center">
          <ShoppingCart className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
          <p className="font-medium text-foreground">No orders found</p>
          <p className="text-sm text-muted-foreground">
            {filter === 'ALL' ? 'Create an order to get started.' : `No orders with status ${filter}.`}
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <caption className="sr-only">List of orders for this branch</caption>
            <thead className="bg-muted text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th scope="col" className="px-4 py-3">Order</th>
                <th scope="col" className="px-4 py-3">Type</th>
                <th scope="col" className="px-4 py-3">Status</th>
                <th scope="col" className="px-4 py-3 text-right">Items</th>
                <th scope="col" className="px-4 py-3 text-right">Total</th>
                <th scope="col" className="px-4 py-3">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {orders.map((order) => (
                <tr key={order.id} className="hover:bg-muted/50">
                  <td className="px-4 py-3">
                    <Link
                      href={`/orders/${order.id}`}
                      className="font-mono font-semibold text-primary hover:underline"
                    >
                      {order.orderNumber}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-foreground">{order.type}</td>
                  <td className="px-4 py-3">
                    <span
                      className={cn(
                        'rounded-full px-2 py-1 text-xs font-semibold',
                        STATUS_STYLES[order.status as OrderStatus],
                      )}
                    >
                      {order.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right text-foreground">
                    {order.items?.length ?? 0}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-foreground">
                    {rupees(String(order.grandTotal))}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {new Date(order.createdAt).toLocaleString('en-IN')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
