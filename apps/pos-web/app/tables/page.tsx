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

/**
 * Table state colours. The hue carries the meaning, so it survives both
 * themes — but each entry MUST pair its own background with its own text
 * colour. A light-only fill (bg-green-50) inherits near-white text in dark
 * mode and the table name disappears, which is exactly the invisible-text
 * bug this palette was introduced to eliminate.
 */
const STATE_STYLES: Record<TableState, string> = {
  AVAILABLE:
    'bg-green-50 border-green-400 text-green-900 dark:bg-green-950 dark:border-green-700 dark:text-green-100',
  OCCUPIED:
    'bg-blue-50 border-blue-400 text-blue-900 dark:bg-blue-950 dark:border-blue-700 dark:text-blue-100',
  RESERVED:
    'bg-amber-50 border-amber-400 text-amber-900 dark:bg-amber-950 dark:border-amber-700 dark:text-amber-100',
  BILLED:
    'bg-purple-50 border-purple-400 text-purple-900 dark:bg-purple-950 dark:border-purple-700 dark:text-purple-100',
  CLEANING:
    'bg-gray-100 border-gray-400 text-gray-700 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-200',
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
    <div className="p-4 sm:p-6">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl sm:text-3xl font-bold text-foreground">
            <TableProperties className="h-6 w-6 sm:h-7 sm:w-7" />
            Floor Plan
          </h1>
          <p className="text-sm text-muted-foreground">
            {branchName ?? 'Branch'} · {tables.length} table{tables.length === 1 ? '' : 's'}
          </p>
        </div>
        <Button onClick={() => setMergeDialogOpen(true)} variant="outline" className="gap-2 min-h-[44px] w-full sm:w-auto justify-center">
          <Merge className="h-4 w-4" />
          Merge Orders
        </Button>
      </div>

      <div className="mb-6 -mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0">
        {counts.map(({ state, count }) => (
            <span key={state} className={cn('shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold', STATE_STYLES[state])}>
              {state} · {count}
            </span>
        ))}
      </div>

      {tablesQuery.isLoading && !tablesQuery.data ? (
        <div className="text-muted-foreground animate-pulse">Loading tables…</div>
      ) : tables.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-12 text-center">
          <TableProperties className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
          <p className="font-medium text-foreground">No tables configured</p>
        </div>
      ) : (
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
                      <Link
                        href={`/orders/create?tableId=${table.id}`}
                        className={cn(
                          'block rounded-lg border-2 p-4 text-center transition-transform hover:scale-105',
                          STATE_STYLES[table.state as TableState] ?? STATE_STYLES.AVAILABLE,
                        )}
                      >
                        <p className="text-xl font-bold text-foreground">{table.name}</p>
                        <p className="mt-1 flex items-center justify-center gap-1 text-xs opacity-80">
                          <Users className="h-3 w-3" />
                          {table.seats} seats
                        </p>
                        <p className="mt-2 text-[11px] font-semibold uppercase tracking-wide">
                          {table.state}
                        </p>
                      </Link>
                      {isOccupied && order && (
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setTransferDialog({
                              open: true,
                              tableId: table.id,
                              tableName: table.name,
                              orderId: order.id,
                            });
                          }}
                          className="absolute -right-2 -top-2 rounded-full border-2 border-card bg-primary p-2 text-primary-foreground shadow-lg transition-transform hover:scale-110"
                          title="Transfer order"
                        >
                          <ArrowRightLeft className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}

      {transferDialog && branchId && (
        <TransferOrderDialog
          open={transferDialog.open}
          onOpenChange={(open) =>
            setTransferDialog(open ? transferDialog : null)
          }
          sourceTableId={transferDialog.tableId}
          sourceTableName={transferDialog.tableName}
          orderId={transferDialog.orderId}
          branchId={branchId}
        />
      )}

      {branchId && (
        <MergeOrdersDialog
          open={mergeDialogOpen}
          onOpenChange={setMergeDialogOpen}
          branchId={branchId}
        />
      )}
    </div>
  );
}
