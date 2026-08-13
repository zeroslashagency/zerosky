'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import {
  ShoppingCart,
  IndianRupee,
  TableProperties,
  TrendingUp,
  AlertCircle,
} from 'lucide-react';
import { trpc } from '@/lib/trpc';
import { useBranch } from '@/hooks/use-branch';
import { useAuth } from '@/lib/auth-context';

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
    return <div className="p-6 text-muted-foreground">Loading branch…</div>;
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
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
        <p className="mt-1 text-muted-foreground">
          {branchName ?? 'Branch'} · today&apos;s activity
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Orders today"
          value={salesQuery.isLoading ? '…' : String(sales?.totalOrders ?? 0)}
          icon={ShoppingCart}
          note="Completed and in progress"
        />
        <StatCard
          title="Revenue today"
          value={salesQuery.isLoading ? '…' : rupees(Number(sales?.totalRevenue ?? 0))}
          icon={IndianRupee}
          note="Gross sales"
        />
        <StatCard
          title="Tables occupied"
          value={tablesQuery.isLoading ? '…' : `${occupied}/${tables.length}`}
          icon={TableProperties}
          note="Live floor state"
        />
        <StatCard
          title="Avg order value"
          value={
            salesQuery.isLoading
              ? '…'
              : rupees(Number(sales?.avgOrderValue ?? 0))
          }
          icon={TrendingUp}
          note="Today"
        />
      </div>

      {(tablesQuery.error || salesQuery.error) && (
        <div className="rounded-lg border border-destructive/20 bg-destructive/10 p-4">
          <p className="font-medium text-destructive">Could not load all dashboard data</p>
          <p className="mt-1 text-sm text-destructive/80">
            {tablesQuery.error?.message ?? salesQuery.error?.message}
          </p>
        </div>
      )}

      <div className="rounded-lg bg-card p-6 shadow">
        <h2 className="mb-4 text-xl font-semibold text-card-foreground">Quick actions</h2>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <QuickAction label="New order" href="/orders/create" />
          <QuickAction label="View menu" href="/menu" />
          <QuickAction label="Billing queue" href="/billing" />
          <QuickAction label="Kitchen view" href="/kitchen" />
        </div>
      </div>
    </div>
  );
}

function StatCard({
  title,
  value,
  icon: Icon,
  note,
}: {
  title: string;
  value: string;
  icon: React.ElementType;
  note: string;
}) {
  return (
    <div className="rounded-lg bg-card p-6 shadow">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-muted-foreground">{title}</p>
          <p className="mt-1 text-2xl font-bold text-card-foreground">{value}</p>
          <p className="mt-2 text-xs text-muted-foreground">{note}</p>
        </div>
        <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary-100">
          <Icon className="h-6 w-6 text-primary-800" />
        </div>
      </div>
    </div>
  );
}

function QuickAction({ label, href }: { label: string; href: string }) {
  return (
    <Link
      href={href}
      className="rounded-lg bg-primary-100 px-4 py-3 text-center font-medium text-primary-800 transition-colors hover:bg-primary-200"
    >
      {label}
    </Link>
  );
}
