'use client';

import { useShift } from '@/hooks/use-shift';
import { useBranch } from '@/hooks/use-branch';
import { OpenShiftForm } from '@/components/shift/open-shift-form';
import { ActiveShiftPanel } from '@/components/shift/active-shift-panel';
import { ShiftHistory } from '@/components/shift/shift-history';

export default function ShiftPage() {
  const { branchName } = useBranch();
  const { shift, branchId, isLoading, error, refetch } = useShift();
  if (isLoading) return <div className="bento-canvas min-h-[100dvh] p-6"><div className="mx-auto max-w-6xl space-y-4"><div className="h-8 w-40 shimmer rounded-xl" /><div className="bento-card h-40" /></div></div>;
  if (error || !branchId) return <div className="p-6"><p role="alert" className="rounded-xl border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">{error ?? 'No branch is available for this account.'}</p></div>;
  return (
    <div className="bento-canvas min-h-[100dvh] p-4 sm:p-6">
      <div className="mx-auto max-w-6xl space-y-6">
        <div><h1 className="text-4xl font-semibold tracking-tighter leading-none text-foreground md:text-5xl">Shift</h1><p className="mt-2 max-w-[65ch] text-sm leading-relaxed text-muted-foreground">Open the till · watch the drawer · hand over counted cash.</p></div>
        {shift ? <ActiveShiftPanel branchId={branchId} shift={shift} onClosed={refetch} /> : <OpenShiftForm branchId={branchId} branchName={branchName} onOpened={refetch} />}
        <ShiftHistory branchId={branchId} />
      </div>
    </div>
  );
}
