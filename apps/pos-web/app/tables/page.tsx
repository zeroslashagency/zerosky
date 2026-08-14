'use client';

import { useState } from 'react';
import Link from 'next/link';
import { TableProperties, Users, AlertCircle, ArrowRightLeft, Merge } from 'lucide-react';
import { keepPreviousData } from '@tanstack/react-query';
import { trpc } from '@/lib/trpc';
import { useBranch } from '@/hooks/use-branch';
import { cn } from '@/lib/utils';
import { Button } from '@zerosky/ui';
import dynamic from 'next/dynamic';
const TransferOrderDialog = dynamic(() => import('@/components/tables/transfer-order-dialog').then((m) => m.TransferOrderDialog), { ssr: false });
const MergeOrdersDialog = dynamic(() => import('@/components/tables/merge-orders-dialog').then((m) => m.MergeOrdersDialog), { ssr: false });

type TableState = 'AVAILABLE' | 'OCCUPIED' | 'RESERVED' | 'BILLED' | 'CLEANING';
const STATE_DOT: Record<TableState, string> = {
  AVAILABLE: 'bg-emerald-500', OCCUPIED: 'bg-sky-500', RESERVED: 'bg-amber-500', BILLED: 'bg-violet-500', CLEANING: 'bg-zinc-400',
};
const STATE_STYLES: Record<TableState, string> = {
  AVAILABLE: 'bg-emerald-50 border-emerald-200 text-emerald-900 dark:bg-emerald-950 dark:border-emerald-800 dark:text-emerald-100',
  OCCUPIED: 'bg-sky-50 border-sky-200 text-sky-900 dark:bg-sky-950 dark:border-sky-800 dark:text-sky-100',
  RESERVED: 'bg-amber-50 border-amber-200 text-amber-900 dark:bg-amber-950 dark:border-amber-800 dark:text-amber-100',
  BILLED: 'bg-violet-50 border-violet-200 text-violet-900 dark:bg-violet-950 dark:border-violet-800 dark:text-violet-100',
  CLEANING: 'bg-zinc-50 border-zinc-200 text-zinc-700 dark:bg-zinc-900 dark:border-zinc-700 dark:text-zinc-200',
};

const STATES: TableState[] = ['AVAILABLE', 'OCCUPIED', 'RESERVED', 'BILLED', 'CLEANING'];

export default function TablesPage() {
  const { branchId, branchName, isLoading: branchLoading, error: branchError } = useBranch();
  const [transferDialog, setTransferDialog] = useState<{
    open: boolean;
    tableId: string;
    tableName: string;
    orderId: string;
  } | null>(null);
  const [mergeDialogOpen, setMergeDialogOpen] = useState(false);

  const tablesQuery = trpc.table.list.useQuery(
    branchId ? { branchId } : { branchId: '' },
    { enabled: Boolean(branchId), refetchInterval: 15_000, placeholderData: keepPreviousData, staleTime: 15_000 },
  );

  const ordersQuery = trpc.order.list.useQuery(
    { branchId: branchId ?? '', limit: 100 },
    { enabled: Boolean(branchId), placeholderData: keepPreviousData, staleTime: 15_000 }
  );

  if (branchLoading) return <div className="bento-canvas min-h-[100dvh] p-6"><div className="mx-auto max-w-[1400px] space-y-4"><div className="h-8 w-40 shimmer rounded-xl" /><div className="grid grid-cols-2 gap-3 lg:grid-cols-5">{Array.from({ length: 10 }).map((_, i) => <div key={i} className="bento-card h-28" />)}</div></div></div>;

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

  const tables = tablesQuery.data ?? [];

  // Find the live order for each occupied table
  const orders = ordersQuery.data ?? [];
  const tableOrders = new Map(
    orders
      .filter((o) => o.tableId && o.status !== 'PAID' && o.status !== 'CANCELLED')
      .map((o) => [o.tableId, o])
  );

  // Group by section so the floor plan reads like the physical room.
  const sections = tables.reduce<Record<string, typeof tables>>((acc, t) => {
    const key = t.section ?? 'Unassigned';
    acc[key] = acc[key] ?? [];
    acc[key].push(t);
    return acc;
  }, {});

  const counts = STATES.map((s) => ({
    state: s,
    count: tables.filter((t) => t.state === s).length,
  }));

  return (
    <div className="bento-canvas min-h-[100dvh] p-4 sm:p-6">
      <div className="mx-auto max-w-[1400px]">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div><h1 className="flex items-center gap-2 text-4xl font-semibold tracking-tighter leading-none text-foreground md:text-5xl"><TableProperties strokeWidth={1.5} className="h-7 w-7" /> Floor</h1><p className="mt-2 text-sm leading-relaxed text-muted-foreground">{branchName ?? 'Branch'} · {tables.length} table{tables.length === 1 ? '' : 's'}</p></div>
        <Button onClick={() => setMergeDialogOpen(true)} variant="outline" className="gap-2 rounded-full min-h-[44px] w-full sm:w-auto justify-center active:scale-[0.98] transition"><Merge strokeWidth={1.5} className="h-4 w-4" /> Merge Orders</Button>
      </div>
      <div className="mt-6 -mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0">{counts.map(({ state, count }) => <span key={state} className={cn('inline-flex items-center gap-1.5 shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium', STATE_STYLES[state])}><span className={cn('h-2 w-2 rounded-full', STATE_DOT[state])} aria-hidden />{state} · {count}</span>)}</div>

      {tablesQuery.isLoading && !tablesQuery.data ? <div className="mt-8 grid grid-cols-2 gap-3 lg:grid-cols-5">{Array.from({ length: 8 }).map((_, i) => <div key={i} className="bento-card h-28" />)}</div> : tables.length === 0 ? <div className="mx-auto mt-10 max-w-md rounded-[2.5rem] border border-dashed border-border bg-card/50 p-10 text-center"><TableProperties strokeWidth={1.5} className="mx-auto mb-3 h-10 w-10 text-muted-foreground" /><p className="font-medium tracking-tight text-foreground">No tables configured</p></div> : (
        <div className="space-y-8">
          {Object.entries(sections).map(([section, sectionTables]) => (
            <section key={section}>
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                {section}
              </h2>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-5">
                {sectionTables.map((table) => {
                  const order = tableOrders.get(table.id);
                  const isOccupied = table.state === 'OCCUPIED' && order;
                  return (
                    <div key={table.id} className="relative">
                      <Link href={`/orders/create?tableId=${table.id}`} className={cn('block rounded-[1.75rem] border p-4 text-center transition hover:shadow-sm active:scale-[0.98]', STATE_STYLES[table.state as TableState] ?? STATE_STYLES.AVAILABLE)}>
                        <p className="font-mono text-sm font-semibold tracking-tight">{table.name}</p>
                        <p className="mt-1 flex items-center justify-center gap-1 text-xs opacity-80"><Users strokeWidth={1.5} className="h-3 w-3" />{table.seats} seats</p>
                        <p className="mt-2 text-[11px] font-semibold uppercase tracking-wide">{table.state}</p>
                      </Link>
                      {isOccupied && order && <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); setTransferDialog({ open: true, tableId: table.id, tableName: table.name, orderId: order.id }); }} className="absolute -right-2 -top-2 rounded-full border border-white/60 bg-card p-2.5 shadow-md transition hover:bg-muted active:scale-[0.96]" title="Transfer order" aria-label="Transfer order"><ArrowRightLeft strokeWidth={1.5} className="h-3.5 w-3.5 text-muted-foreground" /></button>}
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}

      {transferDialog && branchId && <TransferOrderDialog open={transferDialog.open} onOpenChange={(open) => setTransferDialog(open ? transferDialog : null)} sourceTableId={transferDialog.tableId} sourceTableName={transferDialog.tableName} orderId={transferDialog.orderId} branchId={branchId} />}
      {branchId && <MergeOrdersDialog open={mergeDialogOpen} onOpenChange={setMergeDialogOpen} branchId={branchId} />}
      </div>
    </div>
  );
}
