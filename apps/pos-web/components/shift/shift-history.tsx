'use client';

import { trpc } from '@/lib/trpc';
import { formatMoney } from '@/components/shift/money';

/** Recent tills for the branch. This is where an owner spots a pattern of shorts. */
export function ShiftHistory({ branchId }: { branchId: string }) {
  const { data, isLoading } = trpc.shift.list.useQuery(
    { branchId, limit: 10 },
    { staleTime: 60 * 1000 },
  );

  if (isLoading) {
    return (
      <div className="rounded-lg border border-border bg-card p-5 text-sm text-muted-foreground shadow">
        Loading shift history…
      </div>
    );
  }

  const shifts = data?.shifts ?? [];
  if (shifts.length === 0) {
    return null;
  }

  return (
    <div className="rounded-lg border border-border bg-card p-5 text-card-foreground shadow">
      <h3 className="mb-4 font-semibold text-card-foreground">Recent shifts</h3>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted">
            <tr>
              <th className="px-3 py-2 text-left font-medium text-muted-foreground">Opened</th>
              <th className="px-3 py-2 text-left font-medium text-muted-foreground">Cashier</th>
              <th className="px-3 py-2 text-right font-medium text-muted-foreground">Expected</th>
              <th className="px-3 py-2 text-right font-medium text-muted-foreground">Counted</th>
              <th className="px-3 py-2 text-right font-medium text-muted-foreground">Variance</th>
            </tr>
          </thead>
          <tbody>
            {shifts.map((shift) => (
              <tr key={shift.id} className="border-b border-border last:border-0">
                <td className="px-3 py-2 text-card-foreground">
                  {new Date(shift.openedAt).toLocaleString('en-IN', {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                  })}
                  {shift.status === 'OPEN' && (
                    <span className="ml-2 rounded bg-emerald-100 px-1.5 py-0.5 text-xs font-semibold text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                      OPEN
                    </span>
                  )}
                </td>
                <td className="px-3 py-2 text-muted-foreground">{shift.openedBy.name}</td>
                <td className="px-3 py-2 text-right text-card-foreground">
                  {shift.expectedCash === null ? '—' : formatMoney(shift.expectedCash)}
                </td>
                <td className="px-3 py-2 text-right text-card-foreground">
                  {shift.closingCash === null ? '—' : formatMoney(shift.closingCash)}
                </td>
                <td className="px-3 py-2 text-right font-semibold">
                  <VarianceCell variance={shift.variance} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function VarianceCell({ variance }: { variance: number | null }) {
  if (variance === null) {
    return <span className="text-muted-foreground">—</span>;
  }
  if (variance === 0) {
    return <span className="text-emerald-600 dark:text-emerald-400">{formatMoney(0)}</span>;
  }
  const tone =
    variance > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-destructive';
  return (
    <span className={tone}>
      {variance > 0 ? '+' : '−'}
      {formatMoney(Math.abs(variance))}
    </span>
  );
}
