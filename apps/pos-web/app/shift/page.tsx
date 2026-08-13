'use client';

import { useShift } from '@/hooks/use-shift';
import { useBranch } from '@/hooks/use-branch';
import { OpenShiftForm } from '@/components/shift/open-shift-form';
import { ActiveShiftPanel } from '@/components/shift/active-shift-panel';
import { ShiftHistory } from '@/components/shift/shift-history';

export default function ShiftPage() {
  const { branchName } = useBranch();
  const { shift, branchId, isLoading, error, refetch } = useShift();

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center text-muted-foreground">
        Loading shift…
      </div>
    );
  }

  if (error || !branchId) {
    return (
      <div className="p-6">
        <p
          role="alert"
          className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          {error ?? 'No branch is available for this account.'}
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Shift</h1>
        <p className="mt-1 text-muted-foreground">
          Open the till, watch the drawer, and hand over with a counted cash figure.
        </p>
      </div>

      {shift ? (
        <ActiveShiftPanel branchId={branchId} shift={shift} onClosed={refetch} />
      ) : (
        <OpenShiftForm branchId={branchId} branchName={branchName} onOpened={refetch} />
      )}

      <ShiftHistory branchId={branchId} />
    </div>
  );
}
