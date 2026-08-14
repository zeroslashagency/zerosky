'use client';

import { BRANCH_QUERY_OPTIONS, mapBranchResult } from '@zerosky/ui';
import { trpc } from '@/lib/trpc';

export function useBranch() {
  const { data, isLoading, error, refetch } = trpc.branch.list.useQuery(undefined, BRANCH_QUERY_OPTIONS);
  return mapBranchResult(data as { id: string; name: string }[] | undefined, isLoading, error as { message: string } | null | undefined, () => void refetch());
}
