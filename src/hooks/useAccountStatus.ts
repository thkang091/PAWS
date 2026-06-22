import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { queryKeys } from "@/constants/queryKeys";
import { getAccountStatus, sendLinkAccountEmail } from "@/services/accountService";

export const useAccountStatus = () =>
  useQuery({
    queryKey: queryKeys.accountStatus,
    queryFn: getAccountStatus,
  });

export const useSendLinkAccountEmail = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: sendLinkAccountEmail,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.accountStatus });
    },
  });
};
