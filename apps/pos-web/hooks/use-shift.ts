'use client';

import { trpc } from '@/lib/trpc';
import { useBranch } from '@/hooks/use-branch';

/**
 * Resolves the till session the current branch is running.
 *
 * Mirrors `useBranch()`: one query, one flat return, no context provider. It
 * chains off useBranch because a shift is always branch-scoped and the session
 * only carries a tenantId.
 *
 * Caching differs from useBranch on purpose. Branches change about never, so
 * that hook caches for half an hour. A till opens and closes several times a
 * day and two terminals share it, so this one keeps a short stale window and
 * refetches on focus — a cashier switching back to the tab must not be looking
 * at a shift someone else already closed.
 */
export function useShift(): {
  shift: NonNullable<ReturnType<typeof useCurrentShiftQuery>['data']> | null;
  branchId: string | undefined;
  isOpen: boolean;
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
} {
  const { branchId, isLoading: branchLoading } = useBranch();
  const query = useCurrentShiftQuery(branchId);

  return {
    shift: query.data ?? null,
    branchId,
    isOpen: Boolean(query.data),
    isLoading: branchLoading || query.isLoading,
    error: query.error?.message ?? null,
    refetch: () => {
      void query.refetch();
    },
  };
}

/** Kept separate so the hook's return type can reference the query's data type. */
function useCurrentShiftQuery(branchId: string | undefined) {
  return trpc.shift.current.useQuery(
    { branchId: branchId ?? '' },
    {
      enabled: Boolean(branchId),
      staleTime: 30 * 1000,
      gcTime: 5 * 60 * 1000,
      refetchOnWindowFocus: true,
      retry: 1,
    },
  );
}
