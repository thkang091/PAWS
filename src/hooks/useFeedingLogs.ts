import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  deleteFeedingLog,
  getTodayFeedingLogs,
  logFeeding,
  type FeedingLog,
} from "@/services/feedingService";

const keys = {
  todayFeedingLogs: (dogId: string) => ["todayFeedingLogs", dogId] as const,
};

export const useTodayFeedingLogs = (dogId?: string) =>
  useQuery({
    queryKey: keys.todayFeedingLogs(dogId ?? ""),
    queryFn: () => getTodayFeedingLogs(dogId ?? ""),
    enabled: Boolean(dogId),
  });

export const useLogFeeding = (dogId: string) => {
  const qc = useQueryClient();
  const key = keys.todayFeedingLogs(dogId);
  return useMutation({
    mutationFn: (input: Parameters<typeof logFeeding>[1]) => logFeeding(dogId, input),
    onMutate: async (input) => {
      await qc.cancelQueries({ queryKey: key });
      const before = qc.getQueryData<FeedingLog[]>(key);
      qc.setQueryData<FeedingLog[]>(key, (logs = []) => [
        ...logs,
        {
          id: `pending-${Date.now()}`,
          dogId,
          logType: input.logType,
          logDate: new Date().toISOString().slice(0, 10),
          mealName: input.mealName ?? null,
          amountGrams: input.amountGrams ?? null,
          note: input.note ?? null,
          createdAt: new Date().toISOString(),
        },
      ]);
      return { before };
    },
    onError: (_error, _input, context) => {
      qc.setQueryData(key, context?.before);
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: key });
    },
  });
};

export const useDeleteFeedingLog = (dogId: string) => {
  const qc = useQueryClient();
  const key = keys.todayFeedingLogs(dogId);
  return useMutation({
    mutationFn: (logId: string) => deleteFeedingLog(logId),
    onMutate: async (logId) => {
      await qc.cancelQueries({ queryKey: key });
      const before = qc.getQueryData<FeedingLog[]>(key);
      qc.setQueryData<FeedingLog[]>(key, (logs = []) => logs.filter((log) => log.id !== logId));
      return { before };
    },
    onError: (_error, _input, context) => {
      qc.setQueryData(key, context?.before);
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: key });
    },
  });
};
