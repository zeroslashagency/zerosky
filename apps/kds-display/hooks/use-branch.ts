'use client';

import { trpc } from '@/lib/trpc';

/**
 * Resolves the branch the current user is working in.
 *
 * The authenticated principal (SafeUser) carries only a tenantId, but almost
 * every operational query (tables, orders, KOTs) is branch-scoped. Until branch
 * selection becomes part of the session, fall back to the tenant's first active
 * branch.
 */
export function useBranch(): {
  branchId: string | undefined;
  branchName: string | undefined;
  isLoading: boolean;
  error: string | null;
} {
  // Nearly every screen waits on this before it can query anything
  // branch-scoped, so it sits on the critical path of every navigation.
  // Branches change about never, so cache it for the whole shift and that
  // waterfall disappears after the first load.
  const { data, isLoading, error } = trpc.branch.list.useQuery(undefined, {
    staleTime: 30 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
    refetchOnWindowFocus: false,
    retry: 1,
  });

  return {
    branchId: data?.[0]?.id,
    branchName: data?.[0]?.name,
    isLoading,
    error: error?.message ?? null,
  };
}
