'use client';

import { useMemo } from 'react';
import { ShoppingCart, IndianRupee, TrendingUp, AlertCircle } from 'lucide-react';
import { trpc } from '@/lib/trpc';
import { useBranch } from '@/hooks/use-branch';
import { useAuth } from '@/lib/auth-context';
import {
  RevenueBento,
  StatBento,
  FloorBento,
  QuickActionsBento,
  SkeletonBento,
} from '@/components/dashboard/bento-cards';

/**
 * Today's date window, rounded to whole days.
 *
 * Both ends must be stable across renders: a `new Date()` end bound produces a
 * new react-query key every render, so the query refetches, re-renders, and
 * loops forever (observed as ~1000 requests and 429s). Rounding the end to the
 * start of tomorrow keeps the key constant for the whole day.
 */
function todayRange(): { startDate: string; endDate: string } {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { startDate: start.toISOString(), endDate: end.toISOString() };
}

function rupees(value: number): string {
  return `₹${value.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
}

export default function DashboardPage() {
  const { user } = useAuth();
  // Memoized so the react-query key stays identical across renders.
  const range = useMemo(() => todayRange(), []);
  const { branchId, branchName, isLoading: branchLoading, error: branchError } = useBranch();

  const tablesQuery = trpc.table.list.useQuery(
    { branchId: branchId ?? '' },
    { enabled: Boolean(branchId) },
  );

  const salesQuery = trpc.reports.salesSummary.useQuery(
    {
      tenantId: user?.tenantId ?? '',
      branchId: branchId ?? '',
      ...range,
    },
    { enabled: Boolean(branchId && user?.tenantId) },
  );

  if (branchLoading) {
    return (
      <div className="bento-canvas min-h-[100dvh] p-4 sm:p-6">
        <div className="mx-auto max-w-[1400px] space-y-6">
          <div className="h-8 w-40 shimmer rounded-xl" />
          <SkeletonBento rows={4} />
        </div>
      </div>
    );
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
  const occupied = tables.filter((t) => t.state === 'OCCUPIED').length;
  const sales = salesQuery.data;

  return (
    <div className="bento-canvas min-h-[100dvh] p-4 sm:p-6">
      <div className="mx-auto max-w-[1400px] space-y-6">
        <div>
          <h1 className="text-4xl font-semibold tracking-tighter leading-none text-foreground md:text-5xl">Dashboard</h1>
          <p className="mt-2 max-w-[65ch] text-sm leading-relaxed text-muted-foreground">{branchName ?? 'Branch'} · today</p>
        </div>

        {/* Bento 2.0 — Row 1: 2fr 1fr 1fr asymmetrical (§6 VARIANCE 8) */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.6fr_1fr_1fr]">
          <RevenueBento value={rupees(Number(sales?.totalRevenue ?? 0))} loading={salesQuery.isLoading} icon={IndianRupee} />
          <StatBento title="Orders today" value={String(sales?.totalOrders ?? 0)} note="Completed and in progress" loading={salesQuery.isLoading} icon={ShoppingCart} />
          <FloorBento occupied={occupied} total={tables.length} loading={tablesQuery.isLoading} />
        </div>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_1fr]">
          <StatBento title="Avg order value" value={rupees(Number(sales?.avgOrderValue ?? 0))} note="Today" loading={salesQuery.isLoading} icon={TrendingUp} />
          <div className="rounded-[2.5rem] border border-dashed border-border bg-transparent p-6">
            <p className="text-xs font-medium tracking-[0.14em] text-muted-foreground">TABLES</p>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">Floor map and turns live in Tables. Occupied {occupied} of {tables.length}.</p>
            <div className="mt-3 flex gap-1.5">
              <span className="h-1.5 w-8 rounded-full bg-emerald-500" /><span className="h-1.5 w-8 rounded-full bg-muted" /><span className="h-1.5 w-8 rounded-full bg-muted" />
            </div>
          </div>
        </div>

        {(tablesQuery.error || salesQuery.error) && (
          <div className="rounded-[1.5rem] border border-destructive/20 bg-destructive/10 p-4">
            <p className="font-medium text-destructive">Could not load all dashboard data</p>
            <p className="mt-1 text-sm text-destructive/80">{tablesQuery.error?.message ?? salesQuery.error?.message}</p>
          </div>
        )}

        <div>
          <p className="mb-3 px-1 text-xs font-medium tracking-[0.14em] text-muted-foreground">QUICK ACTIONS</p>
          <QuickActionsBento />
        </div>
      </div>
    </div>
  );
}
