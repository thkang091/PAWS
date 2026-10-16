import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { queryKeys } from "@/constants/queryKeys";
import { confirmEmailLink, finishLink, getAccountStatus, startEmailLink, startProviderLink } from "@/services/accountService";

export const useAccountStatus = () =>
  useQuery({
    queryKey: queryKeys.accountStatus,
    queryFn: getAccountStatus,
  });

/** After any link, account status and anything that depends on it (Pet Shop eligibility) must be read again. */
const useLinked = () => {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.accountStatus });
    void queryClient.invalidateQueries({ queryKey: ["petRewards"] });
  };
};

export const useStartEmailLink = () => useMutation({ mutationFn: startEmailLink });

export const useConfirmEmailLink = () => {
  const linked = useLinked();
  return useMutation({ mutationFn: ({ email, code }: { email: string; code: string }) => confirmEmailLink(email, code), onSuccess: linked });
};

export const useStartProviderLink = () => useMutation({ mutationFn: startProviderLink });

export const useFinishLink = () => {
  const linked = useLinked();
  return useMutation({ mutationFn: finishLink, onSuccess: linked });
};
