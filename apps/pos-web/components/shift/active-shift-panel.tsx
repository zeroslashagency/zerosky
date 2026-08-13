'use client';

import { useState } from 'react';
import { AlertTriangle, Banknote, Clock, Lock, Receipt, User2 } from 'lucide-react';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { CloseShiftDialog } from '@/components/shift/close-shift-dialog';
import { formatElapsed, formatMoney } from '@/components/shift/money';

interface ActiveShiftPanelProps {
  branchId: string;
  shift: {
    id: string;
    openingCash: number;
    openedAt: Date;
    notes: string | null;
    openedBy: { id: string; name: string; role: string };
  };
  onClosed: () => void;
}

export function ActiveShiftPanel({ branchId, shift, onClosed }: ActiveShiftPanelProps) {
  const [closing, setClosing] = useState(false);

  // Live totals: the panel is the cashier's running view of the drawer, so keep
  // it fresh without hammering the API.
  const { data: summary, isLoading } = trpc.shift.summary.useQuery(
    { shiftId: shift.id },
    { refetchInterval: 30_000, staleTime: 15_000 },
  );

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-border bg-card p-5 text-card-foreground shadow">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-flex h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
              <h2 className="text-lg font-semibold text-card-foreground">Shift open</h2>
            </div>
            <div className="mt-2 space-y-1 text-sm text-muted-foreground">
              <p className="flex items-center gap-2">
                <User2 className="h-4 w-4" />
                Opened by{' '}
                <span className="font-medium text-card-foreground">{shift.openedBy.name}</span>
                <span className="text-xs uppercase tracking-wide">{shift.openedBy.role}</span>
              </p>
              <p className="flex items-center gap-2">
                <Clock className="h-4 w-4" />
                {new Date(shift.openedAt).toLocaleString('en-IN')}
                <span className="text-xs">({formatElapsed(shift.openedAt)} ago)</span>
              </p>
              <p className="flex items-center gap-2">
                <Banknote className="h-4 w-4" />
                Opening float {formatMoney(shift.openingCash)}
              </p>
            </div>
            {shift.notes && (
              <p className="mt-3 rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground">
                {shift.notes}
              </p>
            )}
          </div>

          <Button onClick={() => setClosing(true)} disabled={isLoading}>
            <Lock className="mr-2 h-4 w-4" />
            Close shift
          </Button>
        </div>
      </div>

      {summary && (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Orders settled" value={String(summary.orderCount)} />
            <StatCard label="Gross sales" value={formatMoney(summary.grossSales)} />
            <StatCard label="Tax collected" value={formatMoney(summary.taxTotal)} />
            <StatCard label="Discounts given" value={formatMoney(summary.discountTotal)} />
          </div>

          {summary.liveOrderCount > 0 && (
            <p className="flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-700 dark:text-amber-300">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                {summary.liveOrderCount} order{summary.liveOrderCount === 1 ? '' : 's'} still open.
                The till cannot close until{' '}
                {summary.liveOrderCount === 1 ? 'it is' : 'they are'} settled or cancelled.
              </span>
            </p>
          )}

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="rounded-lg border border-border bg-card p-5 text-card-foreground shadow">
              <h3 className="mb-3 flex items-center gap-2 font-semibold text-card-foreground">
                <Banknote className="h-4 w-4 text-muted-foreground" />
                Drawer
              </h3>
              <dl className="space-y-2 text-sm">
                <Row label="Opening float" value={formatMoney(summary.openingCash)} />
                <Row label="Cash taken" value={formatMoney(summary.cashIn)} />
                <Row label="Cash refunded" value={`− ${formatMoney(summary.cashRefunds)}`} />
                <div className="border-t border-border pt-2">
                  <Row
                    label="Expected in drawer"
                    value={formatMoney(summary.expectedCash)}
                    emphasis
                  />
                </div>
              </dl>
              <p className="mt-3 text-xs text-muted-foreground">
                Card, UPI and wallet takings never enter the drawer, so they are excluded here.
              </p>
            </div>

            <div className="rounded-lg border border-border bg-card p-5 text-card-foreground shadow">
              <h3 className="mb-3 flex items-center gap-2 font-semibold text-card-foreground">
                <Receipt className="h-4 w-4 text-muted-foreground" />
                Payments by method
              </h3>
              {Object.keys(summary.paymentBreakdown).length === 0 ? (
                <p className="text-sm text-muted-foreground">Nothing collected yet.</p>
              ) : (
                <dl className="space-y-2 text-sm">
                  {Object.entries(summary.paymentBreakdown).map(([method, detail]) => (
                    <Row
                      key={method}
                      label={`${method} (${detail.count})`}
                      value={formatMoney(detail.amount)}
                    />
                  ))}
                </dl>
              )}
            </div>
          </div>

          <CloseShiftDialog
            open={closing}
            branchId={branchId}
            expectedCash={summary.expectedCash}
            liveOrderCount={summary.liveOrderCount}
            onOpenChange={setClosing}
            onClosed={onClosed}
          />
        </>
      )}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4 text-card-foreground shadow">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-bold text-card-foreground">{value}</p>
    </div>
  );
}

function Row({
  label,
  value,
  emphasis,
}: {
  label: string;
  value: string;
  emphasis?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="text-muted-foreground">{label}</dt>
      <dd
        className={
          emphasis
            ? 'text-lg font-bold text-card-foreground'
            : 'font-medium text-card-foreground'
        }
      >
        {value}
      </dd>
    </div>
  );
}
