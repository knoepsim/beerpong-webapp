import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, NetworkError } from "@/lib/api";
import { queryKeys } from "@/lib/query-keys";
import type { User } from "@/types";

/**
 * Who is logged in; `null` is nobody. Asked as a guest: without a session that is an answer, not a reason to go to
 * the login. A network problem says nothing about the session: the error keeps the user that is known (React Query
 * keeps the last data) and it is asked again as soon as the browser is back online.
 */
async function loadMe(): Promise<User | null> {
  try {
    return await api.users.me({ guest: true });
  } catch (error) {
    if (error instanceof NetworkError) throw error;
    return null;
  }
}

export function useCurrentUser() {
  const query = useQuery({
    queryKey: queryKeys.me,
    queryFn: loadMe,
    refetchOnReconnect: "always",
  });
  return {
    user: query.data ?? null,
    isLoading: query.isPending,
    reload: async () => {
      await query.refetch();
    },
  };
}

/** Name and e-mail; the answer is the new state of the user. */
export function useUpdateMe({ successMessage }: { successMessage?: string } = {}) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { name?: string; email?: string }) => api.users.updateMe(data),
    onSuccess: (user) => queryClient.setQueryData(queryKeys.me, user),
    meta: { inlineError: true, successMessage },
  });
}

export function useRequestPhoneChange() {
  return useMutation({
    mutationFn: (phoneNumber: string) => api.users.requestPhoneChange(phoneNumber),
    meta: { inlineError: true },
  });
}

export function useVerifyPhoneChange() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ phoneNumber, code }: { phoneNumber: string; code: string }) =>
      api.users.verifyPhoneChange(phoneNumber, code),
    onSuccess: (user) => queryClient.setQueryData(queryKeys.me, user),
    meta: { inlineError: true, successMessage: "Handynummer geändert." },
  });
}

/** People to give a role to; asked only for a search of at least 2 characters. */
export function useUserSearch(query: string) {
  return useQuery({
    queryKey: queryKeys.userSearch(query),
    queryFn: () => api.users.search(query),
    enabled: query.length >= 2,
    meta: { errorMessage: "Die Suche hat nicht geklappt. Versuch es noch einmal." },
  });
}

export function useRequestCode() {
  return useMutation({
    mutationFn: (phoneNumber: string) => api.auth.requestCode(phoneNumber),
    meta: { inlineError: true },
  });
}

/** Logs in and answers who that is (the login decides with it whether the profile is still to be completed). */
export function useVerifyCode() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ phoneNumber, code }: { phoneNumber: string; code: string }) => {
      await api.auth.verify(phoneNumber, code);
      return api.users.me();
    },
    onSuccess: (user) => queryClient.setQueryData(queryKeys.me, user),
    meta: { inlineError: true },
  });
}
