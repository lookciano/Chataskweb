import { trpc } from "@/lib/trpc";
import { useCallback, useMemo } from "react";

type UseAuthOptions = {
  redirectOnUnauthenticated?: boolean;
  redirectPath?: string;
};

export function useAuth(options?: UseAuthOptions) {
  const { redirectOnUnauthenticated = false, redirectPath } = options ?? {};
  const utils = trpc.useUtils();

  const meQuery = trpc.auth.me.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: false,
  });

  const identitiesQuery = trpc.auth.listIdentities.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: false,
  });

  const selectIdentityMutation = trpc.auth.selectIdentity.useMutation({
    onSuccess: async (user) => {
      utils.auth.me.setData(undefined, user);
      await utils.auth.me.invalidate();
    },
  });

  const logoutMutation = trpc.auth.logout.useMutation({
    onSuccess: () => {
      utils.auth.me.setData(undefined, null);
    },
  });

  const selectIdentity = useCallback(
    async (userId: number) => {
      return selectIdentityMutation.mutateAsync({ userId });
    },
    [selectIdentityMutation]
  );

  const logout = useCallback(async () => {
    try {
      await logoutMutation.mutateAsync();
    } catch {
      // ignore
    } finally {
      utils.auth.me.setData(undefined, null);
      await utils.auth.me.invalidate();
    }
  }, [logoutMutation, utils]);

  const state = useMemo(() => {
    const user = meQuery.data ?? null;
    return {
      user,
      loading:
        meQuery.isLoading ||
        identitiesQuery.isLoading ||
        logoutMutation.isPending ||
        selectIdentityMutation.isPending,
      error: meQuery.error ?? logoutMutation.error ?? selectIdentityMutation.error ?? null,
      isAuthenticated: Boolean(user),
      identities: identitiesQuery.data ?? [],
      needsIdentity: !meQuery.isLoading && !user,
    };
  }, [
    meQuery.data,
    meQuery.error,
    meQuery.isLoading,
    identitiesQuery.data,
    identitiesQuery.isLoading,
    logoutMutation.error,
    logoutMutation.isPending,
    selectIdentityMutation.error,
    selectIdentityMutation.isPending,
  ]);

  return {
    ...state,
    refresh: () => meQuery.refetch(),
    logout,
    selectIdentity,
    selecting: selectIdentityMutation.isPending,
  };
}
