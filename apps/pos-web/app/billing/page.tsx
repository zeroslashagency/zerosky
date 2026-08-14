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
    <div className="p-4 sm:p-6">
      <div className="mb-6">
        <h1 className="flex items-center gap-2 text-2xl sm:text-3xl font-bold text-foreground">
          <Receipt className="h-6 w-6 sm:h-7 sm:w-7" />
          Billing
        </h1>
        <p className="text-sm text-muted-foreground">
          {pending.length} order{pending.length === 1 ? '' : 's'} awaiting settlement ·{' '}
          {rupees(outstanding)} outstanding
        </p>
      </div>

      {isLoading && pending.length === 0 ? (
        <div className="text-muted-foreground animate-pulse">Loading billing queue…</div>
      ) : pending.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-12 text-center">
          <Receipt className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
          <p className="font-medium text-foreground">Nothing to bill</p>
          <p className="text-sm text-muted-foreground">
            Orders appear here once the kitchen has served them.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {pending.map((order) => (
            <div key={order.id} className="relative">
              <Link
                href={`/orders/${order.id}`}
                prefetch={false}
                className="block rounded-lg border border-border p-4 shadow-sm transition-shadow hover:shadow-md bg-card"
              >
                <div className="mb-3 flex items-start justify-between">
                  <div>
                    <p className="font-mono font-bold text-card-foreground">{order.orderNumber}</p>
                    <p className="text-xs text-muted-foreground">{order.type}</p>
                  </div>
                  <span
                    className={cn(
                      'rounded-full px-2 py-1 text-xs font-semibold',
                      order.status === 'BILLED'
                        ? 'bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-100'
                        : 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-100',
                    )}
                  >
                    {order.status}
                  </span>
                </div>

                <dl className="space-y-1 border-t border-border pt-3 text-sm">
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Subtotal</dt>
                    <dd className="text-card-foreground">{rupees(String(order.subtotal))}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">GST</dt>
                    <dd className="text-card-foreground">{rupees(String(order.taxTotal))}</dd>
                  </div>
                  {Number(order.discountTotal) > 0 && (
                    <div className="flex justify-between text-green-700 dark:text-green-400">
                      <dt>Discount</dt>
                      <dd>−{rupees(String(order.discountTotal))}</dd>
                    </div>
                  )}
                  <div className="flex justify-between border-t border-border pt-1 font-bold text-card-foreground">
                    <dt>Total</dt>
                    <dd>{rupees(String(order.grandTotal))}</dd>
                  </div>
                </dl>

                <p className="mt-3 text-center text-xs font-medium text-primary">
                  Open to take payment →
                </p>
              </Link>
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setSplitDialog({
                    open: true,
                    orderId: order.id,
                    orderNumber: order.orderNumber,
                    grandTotal: Number(order.grandTotal),
                  });
                }}
                className="absolute -right-2 -top-2 rounded-full border-2 border-card bg-primary p-2 text-primary-foreground shadow-lg transition-transform hover:scale-110"
                title="Split bill"
              >
                <Split className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {splitDialog && (
        <SplitBillDialog
          open={splitDialog.open}
          onOpenChange={(open) => setSplitDialog(open ? splitDialog : null)}
          orderId={splitDialog.orderId}
          orderNumber={splitDialog.orderNumber}
          grandTotal={splitDialog.grandTotal}
        />
      )}
    </div>
  );
}
