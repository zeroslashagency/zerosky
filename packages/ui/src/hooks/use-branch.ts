/**
 * Shared branch-resolution helpers.
 *
 * The authenticated principal carries only a tenantId, but operational queries
 * are branch-scoped. Branch selection is not yet part of the session, so every
 * screen falls back to the tenant's first active branch. The query options and
 * result mapper are shared here so pos-web and kds-display do not duplicate
 * the same 30-minute cache config (staleTime/gcTime/refetchOnWindowFocus/retry).
 */

export const BRANCH_QUERY_OPTIONS = {
  staleTime: 30 * 60 * 1000,
  gcTime: 60 * 60 * 1000,
  refetchOnWindowFocus: false,
  retry: 1,
} as const;

export function mapBranchResult(
  data: { id: string; name: string }[] | undefined,
  isLoading: boolean,
  error: { message: string } | null | undefined,
  refetch?: () => void,
): {
  branchId: string | undefined;
  branchName: string | undefined;
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
} {
  return {
    branchId: data?.[0]?.id,
    branchName: data?.[0]?.name,
    isLoading,
    error: error?.message ?? null,
    refetch: refetch ?? (() => {}),
  };
}
