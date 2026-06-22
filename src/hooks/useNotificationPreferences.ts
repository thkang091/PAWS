import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { queryKeys } from "@/constants/queryKeys";
import { getNotificationPreferences, saveNotificationPreferences } from "@/services/notificationService";

export const useNotificationPreferences = () =>
  useQuery({ queryKey: queryKeys.notificationPreferences, queryFn: getNotificationPreferences });

export const useSaveNotificationPreferences = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: saveNotificationPreferences,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.notificationPreferences });
    },
  });
};
